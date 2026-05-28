"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { deleteRekognitionCollection } from "@/lib/aws/rekognition";
import { extractDriveFolderId } from "@/lib/google-drive";
import { isValidTier, TIER_CONFIG, type EventTier } from "@/lib/credit-packages";

export type EventActionState = { error: string } | undefined;

/** อัปเดตเฉพาะ folder list — ใช้จาก Drive modal */
export async function updateEventFolders(
  eventId: string,
  folders: { label: string; folder_id: string }[],
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Dedup + extract real folder IDs
  const seen = new Set<string>();
  const clean = folders
    .map((f) => ({ label: f.label.trim(), folder_id: extractDriveFolderId(f.folder_id.trim()) }))
    .filter((f) => {
      if (!f.folder_id || seen.has(f.folder_id)) return false;
      seen.add(f.folder_id);
      return true;
    });

  const { error: delErr } = await supabase
    .from("event_storage_folders")
    .delete()
    .eq("event_id", eventId);
  if (delErr) return { error: delErr.message };

  if (clean.length > 0) {
    const { error: insErr } = await supabase
      .from("event_storage_folders")
      .insert(clean.map((f) => ({ event_id: eventId, label: f.label, folder_id: f.folder_id })));
    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

type ParsedFolder = { label: string; folder_id: string };
type ParsedForm = {
  name: string;
  event_date: string | null;
  folders: ParsedFolder[];
  tier: EventTier;
};

function parseForm(formData: FormData): ParsedForm {
  const name = String(formData.get("name") ?? "").trim();
  const event_date = String(formData.get("event_date") ?? "").trim() || null;
  const rawTier = String(formData.get("tier") ?? "starter");
  const tier: EventTier = isValidTier(rawTier) ? rawTier : "starter";

  const labels = formData.getAll("folder_labels[]").map((v) => String(v).trim());
  const rawIds = formData.getAll("folder_ids[]").map((v) => String(v).trim());

  const folders: ParsedFolder[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawIds.length; i++) {
    const folder_id = extractDriveFolderId(rawIds[i]);
    if (!folder_id || seen.has(folder_id)) continue;
    seen.add(folder_id);
    folders.push({ label: labels[i] ?? "", folder_id });
  }

  return { name, event_date, folders, tier };
}

function validate({ name }: ParsedForm): EventActionState {
  if (!name) return { error: "กรุณากรอกชื่อ event" };
  if (name.length > 120) return { error: "ชื่อ event ยาวเกิน 120 ตัวอักษร" };
  return undefined;
}

export async function createEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const input = parseForm(formData);
  const invalid = validate(input);
  if (invalid) return invalid;

  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { error: "ไม่พบ session (กรุณา login ใหม่)" };

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, credit_balance")
    .eq("owner_user_id", user.id)
    .single();
  if (tenantError || !tenant) {
    return { error: "ไม่พบ tenant ของคุณ (อาจ session หมดอายุ)" };
  }

  const tierCfg = TIER_CONFIG[input.tier];

  // Optimistic UX pre-check; the RPC's FOR UPDATE row-lock is the authoritative double-spend guard.
  if (tenant.credit_balance < tierCfg.creditCost) {
    return {
      error: `เครดิตไม่พอ — ต้องการ ${tierCfg.creditCost} cr แต่มีเพียง ${tenant.credit_balance} cr กรุณาเติมเครดิตก่อนสร้าง event`,
    };
  }

  const { data: eventId, error: rpcError } = await admin.rpc(
    "create_event_deduct_credit",
    {
      p_tenant_id: tenant.id,
      p_name: input.name,
      p_event_date: input.event_date,
      p_tier: input.tier,
      p_storage_limit_gb: tierCfg.storageLimitGb,
      p_link_active_days: tierCfg.linkActiveDays,
      p_data_retention_days: tierCfg.dataRetentionDays,
      p_credit_cost: tierCfg.creditCost,
    },
  );

  if (rpcError) {
    if (rpcError.message.includes("insufficient_credits")) {
      return {
        error: `เครดิตไม่พอ — ต้องการ ${tierCfg.creditCost} cr แต่มีเพียง ${tenant.credit_balance} cr กรุณาเติมเครดิตก่อนสร้าง event`,
      };
    }
    return { error: rpcError.message };
  }

  if (!eventId) return { error: "สร้าง event ไม่สำเร็จ" };

  if (input.folders.length > 0) {
    const { error: folderErr } = await admin
      .from("event_storage_folders")
      .insert(
        input.folders.map((f) => ({
          event_id: eventId,
          label: f.label,
          folder_id: f.folder_id,
        })),
      );
    if (folderErr) {
      // Roll back the event so the user can retry without orphans.
      await admin.from("events").delete().eq("id", eventId);
      return { error: `เพิ่ม folder ไม่สำเร็จ: ${folderErr.message}` };
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}

export async function updateEvent(
  id: string,
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const input = parseForm(formData);
  const invalid = validate(input);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: input.name,
      event_date: input.event_date,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Replace-all strategy for folders: delete existing then insert new.
  // RLS guards both calls; race risk between same-user edits is acceptable.
  const { error: delErr } = await supabase
    .from("event_storage_folders")
    .delete()
    .eq("event_id", id);
  if (delErr) return { error: `ลบ folder เก่าไม่สำเร็จ: ${delErr.message}` };

  if (input.folders.length > 0) {
    const { error: insErr } = await supabase
      .from("event_storage_folders")
      .insert(
        input.folders.map((f) => ({
          event_id: id,
          label: f.label,
          folder_id: f.folder_id,
        })),
      );
    if (insErr) return { error: `เพิ่ม folder ไม่สำเร็จ: ${insErr.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${id}`);
  redirect(`/dashboard/events/${id}`);
}

export async function softDeleteEvent(id: string) {
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) throw new Error("ไม่พบ session (กรุณา login ใหม่)");

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();
  if (tenantError || !tenant) throw new Error("ไม่พบ tenant ของคุณ");

  const { data: event } = await admin
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", id)
    .single();

  const { error: rpcError } = await admin.rpc("delete_event_with_refund", {
    p_event_id: id,
    p_tenant_id: tenant.id,
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  if (event?.rekognition_collection_id) {
    await deleteRekognitionCollection(event.rekognition_collection_id);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** อัปเดตเฉพาะชื่อ event — ใช้สำหรับ inline edit */
export async function updateEventName(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "กรุณากรอกชื่อ event" };
  if (trimmed.length > 120) return { error: "ชื่อ event ยาวเกิน 120 ตัวอักษร" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ name: trimmed })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${id}`);
  return {};
}

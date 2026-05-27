"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteRekognitionCollection } from "@/lib/aws/rekognition";
import { extractDriveFolderId } from "@/lib/google-drive";

export type EventActionState = { error: string } | undefined;

type ParsedFolder = { label: string; folder_id: string };
type ParsedForm = {
  name: string;
  event_date: string | null;
  folders: ParsedFolder[];
};

function parseForm(formData: FormData): ParsedForm {
  const name = String(formData.get("name") ?? "").trim();
  const event_date = String(formData.get("event_date") ?? "").trim() || null;

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

  return { name, event_date, folders };
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
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .single();
  if (tenantError || !tenant) {
    return { error: "ไม่พบ tenant ของคุณ (อาจ session หมดอายุ)" };
  }

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      tenant_id: tenant.id,
      name: input.name,
      event_date: input.event_date,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Insert failed" };

  if (input.folders.length > 0) {
    const { error: folderErr } = await supabase
      .from("event_storage_folders")
      .insert(
        input.folders.map((f) => ({
          event_id: created.id,
          label: f.label,
          folder_id: f.folder_id,
        })),
      );
    if (folderErr) {
      // Roll back the event so the user can retry without orphans.
      await supabase.from("events").delete().eq("id", created.id);
      return { error: `เพิ่ม folder ไม่สำเร็จ: ${folderErr.message}` };
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${created.id}`);
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

  const { data: event } = await supabase
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("events")
    .update({
      deleted_at: new Date().toISOString(),
      rekognition_collection_id: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  if (event?.rekognition_collection_id) {
    await deleteRekognitionCollection(event.rekognition_collection_id);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

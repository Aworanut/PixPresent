"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Archive folders are events underneath (mask change — see the spec). Business
// creates them FREE: direct insert, no credit RPC, no ledger entry. Pricing is
// #B-06's decision; flipping this back = changing this one action.
//
// Defaults rationale (spec "Decisions"):
//   tier 'studio'            — must satisfy events.tier check constraint
//   storage_limit_gb 100     — roomy sync quota for an archive folder
//   link_active_days 7       — share links still re-issuable per event
//   data_retention_days 3650 — guards the guest page's isDataExpired
//                              (it ignores unlimited-retention plans — known bug)
//   activated_at now()       — downstream flows treat the event as active
const ARCHIVE_FOLDER_DEFAULTS = {
  tier: "studio",
  storage_limit_gb: 100,
  link_active_days: 7,
  data_retention_days: 3650,
} as const;

export async function createArchiveFolderAction(formData: FormData): Promise<{ eventId: string }> {
  const ctx = await getCurrentTenant();
  if (!ctx) throw new Error("ต้องเข้าสู่ระบบ");
  if (ctx.tenant.plan !== "business") {
    throw new Error("สร้างแฟ้มคลังได้เฉพาะแพ็กเกจ Business");
  }

  const name = (formData.get("name") as string)?.trim();
  const eventDate = (formData.get("event_date") as string)?.trim() || null;
  if (!name) throw new Error("กรุณาตั้งชื่อแฟ้ม");
  if (name.length > 120) throw new Error("ชื่อแฟ้มยาวเกิน 120 ตัวอักษร");

  const admin = createServiceRoleClient();
  const { data: event, error } = await admin
    .from("events")
    .insert({
      tenant_id: ctx.tenant.id,
      name,
      event_date: eventDate,
      ...ARCHIVE_FOLDER_DEFAULTS,
      credits_used: 0,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !event) throw new Error(error?.message ?? "สร้างแฟ้มไม่สำเร็จ");

  revalidatePath("/dashboard");
  return { eventId: event.id };
}

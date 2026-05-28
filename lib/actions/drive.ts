"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** ยกเลิกการเชื่อมต่อ Google Drive — ลบ refresh token ออกจาก tenant */
export async function disconnectDrive(eventId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: event } = await admin
    .from("events")
    .select("tenant_id")
    .eq("id", eventId)
    .single();
  if (!event) return { error: "ไม่พบ event" };

  const { data: tenant } = await admin
    .from("tenants")
    .select("owner_user_id")
    .eq("id", event.tenant_id)
    .single();
  if (tenant?.owner_user_id !== user.id) return { error: "ไม่มีสิทธิ์" };

  const { error } = await admin
    .from("tenants")
    .update({ google_refresh_token: null })
    .eq("id", event.tenant_id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

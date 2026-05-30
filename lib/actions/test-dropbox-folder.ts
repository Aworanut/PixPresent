"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeDropboxFolderPath } from "@/lib/dropbox";
import type { TestResult } from "@/lib/actions/test-drive-folder";

/** ทดสอบว่า Dropbox folder path เข้าถึงได้ด้วย account ที่ connect ไว้ */
export async function testDropboxFolder(
  eventId: string,
  rawInput: string,
): Promise<TestResult> {
  const path = normalizeDropboxFolderPath(rawInput);
  if (!path && rawInput.trim()) {
    return { ok: false, message: "วาง path เช่น /Events/Wedding (ไม่ใช่ลิงก์)" };
  }

  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ยังไม่ได้ login" };

  const { data: event } = await admin
    .from("events")
    .select("tenant_id")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, message: "ไม่พบ event" };

  const { data: tenant } = await admin
    .from("tenants")
    .select("dropbox_refresh_token, owner_user_id")
    .eq("id", event.tenant_id)
    .single();

  if (tenant?.owner_user_id !== user.id) return { ok: false, message: "ไม่มีสิทธิ์" };
  if (!tenant?.dropbox_refresh_token) {
    return { ok: false, message: "ยังไม่ได้เชื่อมต่อ Dropbox" };
  }

  try {
    const { refreshDropboxToken, dropboxGetFolderMeta } = await import("@/lib/dropbox-api");
    const accessToken = await refreshDropboxToken(tenant.dropbox_refresh_token);
    const meta = await dropboxGetFolderMeta(accessToken, path);
    if (!meta.ok) {
      if (meta.status === 409) return { ok: false, message: "ไม่พบ folder หรือนี่ไม่ใช่ folder" };
      if (meta.status === 401) return { ok: false, message: "การเชื่อมต่อ Dropbox หมดอายุ — connect ใหม่" };
      return { ok: false, message: "เชื่อมต่อไม่ได้ — ลองอีกครั้ง" };
    }
    return { ok: true, name: meta.name };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่ได้ — ลองอีกครั้ง" };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractDriveFolderId } from "@/lib/google-drive";

export type TestResult =
  | { ok: true; name: string }
  | { ok: false; message: string };

/**
 * ทดสอบว่า Google Drive folder เข้าถึงได้ด้วย account ที่ connect ไว้
 * ตรวจสอบ: URL/ID ถูกรูปแบบ, folder มีอยู่จริง, มีสิทธิ์อ่าน
 */
export async function testDriveFolder(
  eventId: string,
  rawInput: string,
): Promise<TestResult> {
  const folderId = extractDriveFolderId(rawInput.trim());
  if (!folderId) {
    return { ok: false, message: "URL หรือ Folder ID ไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ยังไม่ได้ login" };

  // Get tenant's refresh token via event
  const { data: event } = await admin
    .from("events")
    .select("tenant_id")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, message: "ไม่พบ event" };

  const { data: tenant } = await admin
    .from("tenants")
    .select("google_refresh_token, owner_user_id")
    .eq("id", event.tenant_id)
    .single();

  if (tenant?.owner_user_id !== user.id) {
    return { ok: false, message: "ไม่มีสิทธิ์" };
  }
  if (!tenant?.google_refresh_token) {
    return { ok: false, message: "ยังไม่ได้เชื่อมต่อ Google Drive" };
  }

  try {
    const { getDriveClient } = await import("@/lib/google-drive-api");
    const drive = getDriveClient(tenant.google_refresh_token);

    const res = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });

    if (res.data.mimeType !== "application/vnd.google-apps.folder") {
      return { ok: false, message: "ลิงก์นี้ไม่ใช่ folder" };
    }

    return { ok: true, name: res.data.name ?? folderId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("notFound")) {
      return { ok: false, message: "ไม่พบ folder — ตรวจสอบ URL อีกครั้ง" };
    }
    if (msg.includes("403") || msg.includes("forbidden") || msg.includes("insufficientPermissions")) {
      return {
        ok: false,
        message: "ไม่มีสิทธิ์เข้าถึง — ตรวจสอบว่า share folder ให้ account ที่ connect แล้ว",
      };
    }
    return { ok: false, message: "เชื่อมต่อไม่ได้ — ลองอีกครั้ง" };
  }
}

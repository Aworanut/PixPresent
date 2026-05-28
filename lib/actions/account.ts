"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentTenant } from "@/lib/auth/current-tenant";

export type AccountActionState = { error: string } | { ok: true } | undefined;

/** อัปเดตชื่อองค์กร */
export async function updateTenantName(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อองค์กร" };
  if (name.length > 120) return { error: "ชื่อยาวเกิน 120 ตัวอักษร" };

  const ctx = await getCurrentTenant();
  if (!ctx) return { error: "ยังไม่ได้ login" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ name })
    .eq("id", ctx.tenant.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/account");
  return { ok: true };
}

/** เปลี่ยนรหัสผ่าน */
export async function changePassword(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "รหัสผ่านไม่ตรงกัน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { ok: true };
}

/** ยกเลิกการเชื่อมต่อ Google Drive ระดับ tenant */
export async function disconnectGoogleAccount(): Promise<{ error?: string }> {
  const ctx = await getCurrentTenant();
  if (!ctx) return { error: "ยังไม่ได้ login" };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("tenants")
    .update({ google_refresh_token: null })
    .eq("id", ctx.tenant.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/account");
  return {};
}

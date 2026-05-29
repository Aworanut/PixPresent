"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import {
  uploadUserAvatar,
  parseAvatarCrop,
} from "@/lib/avatar-upload";
import { isStoredAvatarUrl } from "@/lib/avatar-url";

export type AccountActionState = { error: string } | { ok: true } | undefined;

/** อัปเดต profile organizer */
export async function updateProfile(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const lineId = String(formData.get("line_id") ?? "").trim();
  const instagramUsername = String(formData.get("instagram_username") ?? "").trim();
  const facebookUrl = String(formData.get("facebook_url") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const tiktokUsername = String(formData.get("tiktok_username") ?? "").trim().replace(/^@/, "");
  const existingAvatarUrl = String(
    formData.get("existing_avatar_url") ?? "",
  ).trim();
  const avatarFile = formData.get("avatar");

  if (!firstName) return { error: "กรุณากรอกชื่อ" };
  if (!lastName) return { error: "กรุณากรอกนามสกุล" };
  if (firstName.length > 80 || lastName.length > 80) {
    return { error: "ชื่อหรือนามสกุลยาวเกิน 80 ตัวอักษร" };
  }
  if (displayName.length > 120) {
    return { error: "Display name ยาวเกิน 120 ตัวอักษร" };
  }
  if (phone.length > 30) {
    return { error: "เบอร์โทรศัพท์ยาวเกิน 30 ตัวอักษร" };
  }
  if (lineId.length > 80) {
    return { error: "Line ID ยาวเกิน 80 ตัวอักษร" };
  }
  if (instagramUsername.length > 80) {
    return { error: "Instagram username ยาวเกิน 80 ตัวอักษร" };
  }
  if (facebookUrl.length > 200) {
    return { error: "Facebook URL ยาวเกิน 200 ตัวอักษร" };
  }
  if (bio.length > 500) {
    return { error: "Bio ยาวเกิน 500 ตัวอักษร" };
  }
  if (tiktokUsername.length > 80) {
    return { error: "TikTok username ยาวเกิน 80 ตัวอักษร" };
  }

  const ctx = await getCurrentTenant();
  if (!ctx) return { error: "ยังไม่ได้ login" };

  const supabase = await createClient();
  const keptAvatar =
    (isStoredAvatarUrl(existingAvatarUrl) && existingAvatarUrl) ||
    (isStoredAvatarUrl(ctx.tenant.avatar_url) && ctx.tenant.avatar_url) ||
    "";

  const avatarResult = await uploadUserAvatar(
    supabase,
    ctx.user.id,
    avatarFile,
    keptAvatar,
    parseAvatarCrop(formData),
  );

  if (avatarResult.error) return { error: avatarResult.error };

  const headerName = displayName || `${firstName} ${lastName}`.trim();

  const { error: tenantError } = await supabase
     .from("tenants")
     .update({
       first_name: firstName,
       last_name: lastName,
       display_name: displayName || null,
       phone: phone || null,
       line_id: lineId || null,
       instagram_username: instagramUsername || null,
       facebook_url: facebookUrl || null,
       bio: bio || null,
       tiktok_username: tiktokUsername || null,
       avatar_url: avatarResult.avatarUrl ?? null,
       name: headerName,
     })
     .eq("id", ctx.tenant.id);

  if (tenantError) return { error: tenantError.message };

  const { error: userError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      display_name: headerName,
      avatar_url: avatarResult.avatarUrl ?? null,
    },
  });

  if (userError) return { error: userError.message };

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

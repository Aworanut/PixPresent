"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  uploadUserAvatar,
  parseAvatarCrop,
} from "@/lib/avatar-upload";
import { isStoredAvatarUrl } from "@/lib/avatar-url";

export type OnboardingState = { error: string } | undefined;

const WELCOME_BONUS = 199;

function isSchemaMissingError(message: string | undefined): boolean {
  return !!message?.includes("onboarding_completed_at");
}

async function ensureTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined,
): Promise<{ tenantId: string } | { error: string }> {
  const { data: existing, error: lookupError } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message };
  }

  if (existing) {
    return { tenantId: existing.id };
  }

  const placeholderName = email?.split("@")[0]?.trim() || "Organizer";
  const { data: created, error: insertError } = await supabase
    .from("tenants")
    .insert({ owner_user_id: userId, name: placeholderName })
    .select("id")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  const admin = createServiceRoleClient();
  await admin
    .from("tenants")
    .update({ credit_balance: WELCOME_BONUS })
    .eq("id", created.id);
  await admin.from("credit_ledger").insert({
    tenant_id: created.id,
    delta: WELCOME_BONUS,
    balance_after: WELCOME_BONUS,
    reason: "welcome_bonus",
    note: "Welcome bonus on signup",
  });

  return { tenantId: created.id };
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
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

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "ยังไม่ได้ login กรุณา refresh หน้าแล้วลองใหม่" };
  }

  const tenantResult = await ensureTenant(supabase, user.id, user.email);
  if ("error" in tenantResult) {
    if (isSchemaMissingError(tenantResult.error)) {
      return {
        error:
          "ฐานข้อมูลยังไม่พร้อมสำหรับ onboarding กรุณารัน migration 20260529120000_tenant_profile_onboarding.sql",
      };
    }
    return { error: tenantResult.error };
  }

  let avatarUrl = isStoredAvatarUrl(existingAvatarUrl)
    ? existingAvatarUrl
    : null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    const avatarResult = await uploadUserAvatar(
      supabase,
      user.id,
      avatarFile,
      existingAvatarUrl,
      parseAvatarCrop(formData),
    );
    if (avatarResult.error) return { error: avatarResult.error };
    avatarUrl = avatarResult.avatarUrl ?? null;
  }

  const headerName = displayName || `${firstName} ${lastName}`.trim();

  const { error: tenantError } = await supabase
    .from("tenants")
    .update({
      first_name: firstName,
      last_name: lastName,
      display_name: displayName || null,
      phone: phone || null,
      avatar_url: avatarUrl,
      name: headerName,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", tenantResult.tenantId);

  if (tenantError) {
    if (isSchemaMissingError(tenantError.message)) {
      return {
        error:
          "ฐานข้อมูลยังไม่พร้อมสำหรับ onboarding กรุณารัน migration 20260529120000_tenant_profile_onboarding.sql",
      };
    }
    return { error: tenantError.message };
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      display_name: headerName,
      avatar_url: avatarUrl,
    },
  });

  if (metadataError) return { error: metadataError.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

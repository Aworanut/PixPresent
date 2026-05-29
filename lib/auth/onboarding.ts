import { createClient } from "@/lib/supabase/server";

export type OnboardingDefaults = {
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
};

function splitFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function extractOnboardingDefaults(
  metadata: Record<string, unknown> | undefined,
): OnboardingDefaults {
  const meta = metadata ?? {};
  const givenName = String(meta.given_name ?? "").trim();
  const familyName = String(meta.family_name ?? "").trim();
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  const split = fullName ? splitFullName(fullName) : { first: "", last: "" };

  return {
    firstName: givenName || split.first,
    lastName: familyName || split.last,
    displayName: fullName,
    avatarUrl:
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null,
  };
}

export function isOnboardingSchemaMissing(message: string | undefined): boolean {
  return !!message?.includes("onboarding_completed_at");
}

export function tenantNeedsOnboarding(
  tenant: { onboarding_completed_at: string | null } | null,
): boolean {
  return !tenant?.onboarding_completed_at;
}

export async function needsOnboarding(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("onboarding_completed_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    if (isOnboardingSchemaMissing(error.message)) return true;
    return true;
  }

  return tenantNeedsOnboarding(tenant);
}

export async function getOnboardingSchemaError(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .select("onboarding_completed_at")
    .limit(1);

  if (error && isOnboardingSchemaMissing(error.message)) {
    return "ฐานข้อมูลยังไม่พร้อม — ต้อง apply migration tenant_profile_onboarding บน Supabase ก่อน";
  }

  return null;
}

export async function getPostAuthRedirect(userId: string): Promise<string> {
  return (await needsOnboarding(userId)) ? "/onboarding" : "/dashboard";
}

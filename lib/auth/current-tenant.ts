import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TenantProfile = {
  id: string;
  name: string;
  plan: string;
  credit_balance: number;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  line_id: string | null;
  instagram_username: string | null;
  facebook_url: string | null;
  bio: string | null;
  tiktok_username: string | null;
};

export type CurrentTenant = {
  user: {
    id: string;
    email: string | undefined;
    avatar_url: string | null;
  };
  tenant: TenantProfile;
};

function metadataAvatar(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const meta = metadata ?? {};
  if (typeof meta.avatar_url === "string" && meta.avatar_url) return meta.avatar_url;
  if (typeof meta.picture === "string" && meta.picture) return meta.picture;
  return null;
}

export const getCurrentTenant = cache(
  async (): Promise<CurrentTenant | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: baseTenant, error: baseError } = await supabase
      .from("tenants")
      .select("id, name, plan, credit_balance")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (baseError || !baseTenant) return null;

    const { data: profile } = await supabase
      .from("tenants")
      .select(
        "avatar_url, first_name, last_name, display_name, phone, line_id, instagram_username, facebook_url, bio, tiktok_username",
      )
      .eq("id", baseTenant.id)
      .maybeSingle();

    const fallbackAvatar = metadataAvatar(user.user_metadata);
    const avatarUrl = profile?.avatar_url ?? fallbackAvatar;

    return {
      user: {
        id: user.id,
        email: user.email,
        avatar_url: avatarUrl,
      },
      tenant: {
        ...baseTenant,
        avatar_url: avatarUrl,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        display_name: profile?.display_name ?? null,
        phone: profile?.phone ?? null,
        line_id: profile?.line_id ?? null,
        instagram_username: profile?.instagram_username ?? null,
        facebook_url: profile?.facebook_url ?? null,
        bio: profile?.bio ?? null,
        tiktok_username: profile?.tiktok_username ?? null,
      },
    };
  },
);

export function tenantDisplayName(tenant: TenantProfile): string {
  return tenant.display_name?.trim() || tenant.name;
}

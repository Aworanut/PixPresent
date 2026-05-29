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

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select(
        "id, name, plan, credit_balance, avatar_url, first_name, last_name, display_name, phone",
      )
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (error || !tenant) return null;

    const fallbackAvatar = metadataAvatar(user.user_metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        avatar_url: tenant.avatar_url ?? fallbackAvatar,
      },
      tenant: {
        ...tenant,
        avatar_url: tenant.avatar_url ?? fallbackAvatar,
      },
    };
  },
);

export function tenantDisplayName(tenant: TenantProfile): string {
  return tenant.display_name?.trim() || tenant.name;
}

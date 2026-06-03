"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type StorageProviderId = "google" | "dropbox";

/**
 * Disconnect a storage provider for the current tenant by clearing its
 * refresh token. Tenant-scoped (no event context) — the connection itself
 * lives on the tenant row, so disconnecting affects every event.
 */
export async function disconnectProvider(
  provider: StorageProviderId,
): Promise<{ error?: string }> {
  const ctx = await getCurrentTenant();
  if (!ctx) return { error: "Unauthorized" };

  const patch =
    provider === "google"
      ? { google_refresh_token: null }
      : { dropbox_refresh_token: null };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("tenants")
    .update(patch)
    .eq("id", ctx.tenant.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/account/connections");
  return {};
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConnectionsSection, type ProviderStatus } from "../_connections-section";

export default async function ConnectionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "google_refresh_token, google_connected_at, dropbox_refresh_token, dropbox_connected_at",
    )
    .eq("owner_user_id", user.id)
    .single();
  if (!tenant) redirect("/login");

  const providers: ProviderStatus[] = [
    {
      id: "google",
      label: "Google Drive",
      connected: !!tenant.google_refresh_token,
      connectedAt: tenant.google_connected_at,
    },
    {
      id: "dropbox",
      label: "Dropbox",
      connected: !!tenant.dropbox_refresh_token,
      connectedAt: tenant.dropbox_connected_at,
    },
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/account"
          className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-1 inline-block"
        >
          ← Account
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Connections
        </h1>
      </div>

      <ConnectionsSection providers={providers} />
    </div>
  );
}

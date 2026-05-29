import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { TenantsTable, type TenantRow } from "./_tenants-table";

export default async function AdminTenantsPage() {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, plan, credit_balance, created_at")
    .order("created_at", { ascending: false })
    .returns<TenantRow[]>();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Tenants
      </h1>
      <TenantsTable tenants={data ?? []} />
    </div>
  );
}

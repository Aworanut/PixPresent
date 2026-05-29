import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StatCard } from "./_stat-card";

export default async function AdminDashboardPage() {
  const admin = createServiceRoleClient();

  const [pending, tenants, events, balances] = await Promise.all([
    admin
      .from("slip_uploads")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.from("tenants").select("id", { count: "exact", head: true }),
    admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin.from("tenants").select("credit_balance"),
  ]);

  const outstanding = (balances.data ?? []).reduce(
    (sum, t) => sum + (t.credit_balance ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending slips"
          value={String(pending.count ?? 0)}
          accent="amber"
          hint="รอตรวจสอบ"
        />
        <StatCard label="Tenants" value={String(tenants.count ?? 0)} />
        <StatCard label="Active events" value={String(events.count ?? 0)} />
        <StatCard
          label="Outstanding credit"
          value={`฿${outstanding.toLocaleString()}`}
          hint="ยอดเครดิตคงค้างรวม"
        />
      </div>
    </div>
  );
}

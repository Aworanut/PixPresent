import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SlipsTable, type SlipRow } from "./_slips-table";

export default async function AdminSlipsPage() {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("slip_uploads")
    .select(
      "id, tenant_id, package_id, amount_thb, credits_claimed, slip_image_url, status, reject_reason, uploaded_at, verified_at, tenants(name)",
    )
    .order("uploaded_at", { ascending: false })
    .limit(200)
    .returns<SlipRow[]>();

  const slips = (data ?? [])
    .slice()
    .sort(
      (a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1),
    );

  const pendingCount = slips.filter((s) => s.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Slip Approvals
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {pendingCount} pending
          </span>{" "}
          / {slips.length} total
        </p>
      </div>
      <SlipsTable slips={slips} />
    </div>
  );
}

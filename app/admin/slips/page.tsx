import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ApproveButton, RejectForm } from "./_slip-actions";

// ── helpers ───────────────────────────────────────────────────────────────────

const PKG_LABEL: Record<string, string> = {
  pack_199: "199 Credits",
  pack_499: "499 Credits",
  pack_999: "999 Credits",
  custom: "Custom",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    approved:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    rejected:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
  };
  const label: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ??
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

// ── page (server component) ───────────────────────────────────────────────────

export default async function AdminSlipsPage() {
  const admin = createServiceRoleClient();

  type SlipRow = {
    id: string;
    tenant_id: string;
    package_id: string;
    amount_thb: number;
    credits_claimed: number;
    slip_image_url: string;
    status: string;
    reject_reason: string | null;
    uploaded_at: string;
    verified_at: string | null;
    tenants: { name: string } | null;
  };

  const { data: rawSlips } = await admin
    .from("slip_uploads")
    .select(
      "id, tenant_id, package_id, amount_thb, credits_claimed, slip_image_url, status, reject_reason, uploaded_at, verified_at, tenants(name)",
    )
    .order("uploaded_at", { ascending: false })
    .limit(100)
    .returns<SlipRow[]>();

  const slips = (rawSlips ?? []).sort(
    (a, b) =>
      (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1),
  );

  const pendingCount = slips.filter((s) => s.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin — Slip Approvals
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {pendingCount} pending
          </span>{" "}
          / {slips.length} total
        </p>
      </div>

      {/* Slip cards */}
      {slips.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ไม่มี slip ในระบบ
        </p>
      ) : (
        <ul className="space-y-4">
          {slips.map((slip) => (
            <li
              key={slip.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3"
            >
              {/* Top row: tenant + date + badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {slip.tenants?.name ?? slip.tenant_id}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {formatDate(slip.uploaded_at)}
                  </p>
                </div>
                <StatusBadge status={slip.status} />
              </div>

              {/* Package info */}
              <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">
                  {PKG_LABEL[slip.package_id] ?? slip.package_id}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span>฿{slip.amount_thb.toLocaleString()}</span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span>{slip.credits_claimed} cr</span>
              </div>

              {/* Slip image link */}
              <a
                href={slip.slip_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View slip image ↗
              </a>

              {/* Actions (pending only) */}
              {slip.status === "pending" && (
                <div className="flex flex-col sm:flex-row gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <ApproveButton slipId={slip.id} />
                  <RejectForm slipId={slip.id} />
                </div>
              )}

              {/* Reject reason */}
              {slip.status === "rejected" && slip.reject_reason && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                  เหตุผล: {slip.reject_reason}
                </div>
              )}

              {/* Approved date */}
              {slip.status === "approved" && slip.verified_at && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Approved: {formatDate(slip.verified_at)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

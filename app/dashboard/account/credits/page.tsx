import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  topup_slip: "เติมเครดิต",
  activate_event: "สร้าง Event",
  refund: "คืนเครดิต",
  adjustment: "ปรับยอด",
  welcome_bonus: "Welcome Bonus",
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

const PKG_LABEL: Record<string, string> = {
  pack_199: "199 Credits",
  pack_499: "499 Credits",
  pack_999: "999 Credits",
  custom: "Custom",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    approved:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    rejected:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ??
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="font-medium text-rose-600 dark:text-rose-400">
        {delta}
      </span>
    );
  }
  return (
    <span className="text-zinc-500 dark:text-zinc-400">0</span>
  );
}

// ── table components ──────────────────────────────────────────────────────────

type SlipRow = Pick<
  Tables<"slip_uploads">,
  "id" | "package_id" | "amount_thb" | "credits_claimed" | "status" | "uploaded_at"
>;

function SlipsTable({ slips }: { slips: SlipRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Slip Uploads
      </h2>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                วันที่
              </th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                แพ็กเกจ
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                จำนวนเงิน (฿)
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Credits
              </th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {slips.map((slip) => (
              <tr key={slip.id}>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {formatDate(slip.uploaded_at)}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {PKG_LABEL[slip.package_id] ?? slip.package_id}
                </td>
                <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                  {slip.amount_thb.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                  {slip.credits_claimed.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={slip.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type LedgerRow = Pick<
  Tables<"credit_ledger">,
  "id" | "delta" | "balance_after" | "reason" | "note" | "created_at"
>;

function LedgerTable({ ledger }: { ledger: LedgerRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Ledger
      </h2>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                วันที่
              </th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                รายการ
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Credits
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                คงเหลือ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {ledger.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500"
                >
                  ยังไม่มีประวัติ
                </td>
              </tr>
            ) : (
              ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {reasonLabel(entry.reason)}
                    {entry.note && (
                      <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                        ({entry.note})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell delta={entry.delta} />
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {entry.balance_after.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function CreditsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, credit_balance")
    .eq("owner_user_id", user.id)
    .single();
  if (!tenant) redirect("/login");

  const { data: ledgerData } = await supabase
    .from("credit_ledger")
    .select("id, delta, balance_after, reason, note, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: slipsData } = await supabase
    .from("slip_uploads")
    .select("id, package_id, amount_thb, credits_claimed, status, uploaded_at")
    .eq("tenant_id", tenant.id)
    .order("uploaded_at", { ascending: false })
    .limit(20);

  const ledger: LedgerRow[] = ledgerData ?? [];
  const slips: SlipRow[] = slipsData ?? [];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/account"
            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-1 inline-block"
          >
            ← Account
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Credit History
          </h1>
        </div>
      </div>

      {/* Balance card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            ยอดคงเหลือ
          </p>
          <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {tenant.credit_balance.toLocaleString()}
            <span className="ml-2 text-xl font-normal text-zinc-400 dark:text-zinc-500">
              cr
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/account/topup"
          className="inline-flex items-center rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          เติมเครดิต
        </Link>
      </div>

      {/* Slip uploads (conditional) */}
      {slips.length > 0 && <SlipsTable slips={slips} />}

      {/* Ledger */}
      <LedgerTable ledger={ledger} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { SlipDrawer } from "./_slip-drawer";

export type SlipRow = {
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

export const PKG_LABEL: Record<string, string> = {
  pack_199: "199",
  pack_499: "499",
  pack_999: "999",
  custom: "Custom",
};

export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Badge({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    approved:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

export function SlipsTable({ slips }: { slips: SlipRow[] }) {
  const [selected, setSelected] = useState<SlipRow | null>(null);

  if (slips.length === 0) {
    return <p className="text-sm text-zinc-500">ไม่มี slip ในระบบ</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
              <th className="px-4 py-2.5 text-left font-medium">Package</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                Uploaded
              </th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {slips.map((slip) => (
              <tr
                key={slip.id}
                onClick={() => setSelected(slip)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {slip.tenants?.name ?? slip.tenant_id}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {PKG_LABEL[slip.package_id] ?? slip.package_id}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  ฿{slip.amount_thb.toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                  {fmt(slip.uploaded_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge status={slip.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlipDrawer slip={selected} onClose={() => setSelected(null)} />
    </>
  );
}

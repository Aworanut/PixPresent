"use client";

import { useState } from "react";
import { TenantDrawer } from "./_tenant-drawer";

export type TenantRow = {
  id: string;
  name: string;
  plan: string;
  credit_balance: number;
  created_at: string;
};

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const [selected, setSelected] = useState<TenantRow | null>(null);

  if (tenants.length === 0) {
    return <p className="text-sm text-zinc-500">ยังไม่มี tenant</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tenants.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelected(t)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </td>
                <td className="px-4 py-3 text-zinc-500">{t.plan}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ฿{t.credit_balance.toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                  {new Date(t.created_at).toLocaleDateString("th-TH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TenantDrawer tenant={selected} onClose={() => setSelected(null)} />
    </>
  );
}

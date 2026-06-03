"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  adjustCredit,
  setTenantPlan,
  getTenantLedger,
  type LedgerEntry,
} from "./_actions";
import { type TenantRow } from "./_tenants-table";
import { TENANT_PLANS } from "@/lib/tenant-plans";

const REASON_LABEL: Record<string, string> = {
  topup_slip: "เติมเงิน",
  activate_event: "เปิดงาน",
  refund: "คืนเครดิต",
  adjustment: "ปรับยอด",
};

export function TenantDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantRow | null;
  onClose: () => void;
}) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState(tenant?.plan ?? "free");
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(tenant?.id);

  // Reset transient state when a different tenant opens (render-time adjustment,
  // not an effect — avoids react-hooks/set-state-in-effect).
  if (tenant?.id !== prevId) {
    setPrevId(tenant?.id);
    setAmount("");
    setNote("");
    setPlan(tenant?.plan ?? "free");
    setError(null);
    setLedger([]);
  }

  // Load the open tenant's recent ledger. The fetch genuinely needs an effect;
  // setLedger runs in the async .then callback (not a synchronous effect
  // setState), so it doesn't trip react-hooks/set-state-in-effect. The `active`
  // guard drops a stale response if the user switches tenants mid-fetch.
  useEffect(() => {
    const id = tenant?.id;
    if (!id) return;
    let active = true;
    getTenantLedger(id).then((rows) => {
      if (active) setLedger(rows);
    });
    return () => {
      active = false;
    };
  }, [tenant?.id]);

  const delta = parseInt(amount, 10);
  const canSubmit = Number.isInteger(delta) && delta !== 0 && note.trim().length > 0;

  return (
    <Drawer open={tenant !== null} onClose={onClose} title="Tenant detail">
      {tenant && (
        <div className="space-y-6">
          <div>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {tenant.name}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Balance:{" "}
              <span className="font-medium tabular-nums">
                ฿{tenant.credit_balance.toLocaleString()}
              </span>{" "}
              · {tenant.plan}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ปรับเครดิต (Adjustment)
            </p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="+100 หรือ -50"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เหตุผล (บันทึกใน ledger)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <ConfirmButton
              confirmLabel="ยืนยันปรับยอด"
              pendingLabel="กำลังบันทึก…"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              onConfirm={async () => {
                setError(null);
                const r = await adjustCredit(tenant.id, delta, note);
                if (r.error) setError(r.error);
                else onClose();
              }}
            >
              ปรับยอด
            </ConfirmButton>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Plan (tier บัญชี)
            </p>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {TENANT_PLANS.map((p) => (
                <option key={p} value={p}>
                  {p === "business" ? "business — เก็บข้อมูลไม่จำกัดเวลา" : p}
                </option>
              ))}
            </select>
            <ConfirmButton
              confirmLabel="ยืนยันเปลี่ยน plan"
              pendingLabel="กำลังบันทึก…"
              disabled={plan === tenant.plan}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              onConfirm={async () => {
                setError(null);
                const r = await setTenantPlan(tenant.id, plan);
                if (r.error) setError(r.error);
                else onClose();
              }}
            >
              เปลี่ยน plan
            </ConfirmButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ประวัติเครดิตล่าสุด
            </p>
            {ledger.length === 0 ? (
              <p className="text-xs text-zinc-400">ยังไม่มีรายการ</p>
            ) : (
              <ul className="space-y-1.5">
                {ledger.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between border-b border-zinc-100 pb-1.5 text-xs dark:border-zinc-800"
                  >
                    <span className="text-zinc-500">
                      {REASON_LABEL[e.reason] ?? e.reason}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        e.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {e.delta >= 0 ? "+" : ""}
                      {e.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

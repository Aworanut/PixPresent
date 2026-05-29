"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { approveSlip, rejectSlip } from "./_actions";
import { type SlipRow, PKG_LABEL, fmt } from "./_slips-table";

export function SlipDrawer({
  slip,
  onClose,
}: {
  slip: SlipRow | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prevId, setPrevId] = useState(slip?.id);

  // Reset transient state when a different slip opens (render-time adjustment,
  // not an effect — avoids react-hooks/set-state-in-effect).
  if (slip?.id !== prevId) {
    setPrevId(slip?.id);
    setReason("");
    setError(null);
  }

  return (
    <Drawer open={slip !== null} onClose={onClose} title="Slip detail">
      {slip && (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {slip.tenants?.name ?? slip.tenant_id}
            </p>
            <p className="text-xs text-zinc-400">{fmt(slip.uploaded_at)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-400">Package</dt>
              <dd className="font-medium">
                {PKG_LABEL[slip.package_id] ?? slip.package_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Amount</dt>
              <dd className="font-medium tabular-nums">
                ฿{slip.amount_thb.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Credits</dt>
              <dd className="font-medium tabular-nums">{slip.credits_claimed}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Status</dt>
              <dd className="font-medium">{slip.status}</dd>
            </div>
          </dl>

          <a href={slip.slip_image_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slip.slip_image_url}
              alt="Slip"
              className="max-h-80 w-full rounded-lg border border-zinc-200 bg-zinc-50 object-contain dark:border-zinc-800 dark:bg-zinc-950"
            />
          </a>

          {slip.status === "pending" && (
            <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <ConfirmButton
                confirmLabel="อนุมัติ"
                pendingLabel="กำลังอนุมัติ…"
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onConfirm={async () => {
                  setError(null);
                  const r = await approveSlip(slip.id);
                  if (r.error) setError(r.error);
                  else onClose();
                }}
              >
                Approve
              </ConfirmButton>

              <div className="space-y-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เหตุผลที่ปฏิเสธ"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <ConfirmButton
                  confirmLabel="ปฏิเสธ"
                  pendingLabel="กำลังปฏิเสธ…"
                  disabled={!reason.trim()}
                  className="w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onConfirm={async () => {
                    setError(null);
                    const r = await rejectSlip(slip.id, reason);
                    if (r.error) setError(r.error);
                    else {
                      setReason("");
                      onClose();
                    }
                  }}
                >
                  Reject
                </ConfirmButton>
              </div>
            </div>
          )}

          {slip.status === "rejected" && slip.reject_reason && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              เหตุผล: {slip.reject_reason}
            </div>
          )}
          {slip.status === "approved" && slip.verified_at && (
            <p className="text-xs text-zinc-400">Approved: {fmt(slip.verified_at)}</p>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>
      )}
    </Drawer>
  );
}

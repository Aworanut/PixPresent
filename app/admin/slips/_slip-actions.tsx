"use client";

import { useState } from "react";
import { approveSlip, rejectSlip } from "./_actions";

// ── ApproveButton ─────────────────────────────────────────────────────────────

export function ApproveButton({ slipId }: { slipId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    const result = await approveSlip(slipId);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, revalidatePath re-renders the page so no manual state reset needed
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleApprove}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-sm font-medium text-white transition-colors"
      >
        {loading ? "กำลังอนุมัติ…" : "Approve"}
      </button>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

// ── RejectForm ────────────────────────────────────────────────────────────────

export function RejectForm({ slipId }: { slipId: string }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReject() {
    setLoading(true);
    setError(null);
    const result = await rejectSlip(slipId, reason);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setReason("");
    // On success, revalidatePath re-renders the page
  }

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผลที่ปฏิเสธ"
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50"
        />
        <button
          onClick={handleReject}
          disabled={loading || !reason.trim()}
          className="inline-flex items-center justify-center rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 transition-colors"
        >
          {loading ? "…" : "Reject"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

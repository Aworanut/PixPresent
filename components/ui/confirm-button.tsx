"use client";

import { useState } from "react";

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "ยืนยัน",
  pendingLabel = "…",
  className = "",
  disabled = false,
}: {
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-zinc-500">แน่ใจ?</span>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm();
            } finally {
              setLoading(false);
              setArmed(false);
            }
          }}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? pendingLabel : confirmLabel}
        </button>
        <button
          disabled={loading}
          onClick={() => setArmed(false)}
          className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
        >
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <button disabled={disabled} onClick={() => setArmed(true)} className={className}>
      {children}
    </button>
  );
}

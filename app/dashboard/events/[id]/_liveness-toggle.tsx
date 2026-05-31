"use client";

import { useState, useTransition } from "react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { setLivenessRequired } from "@/lib/actions/events";

export function LivenessToggle({
  eventId,
  initial,
}: {
  eventId: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !enabled;

    // Turning ON is a footgun until the live-scan frontend ships: the guest
    // upload path fails closed, so guests cannot find their photos at all.
    // Make that explicit before flipping.
    if (next) {
      const ok = window.confirm(
        "เปิดโหมดยืนยันตัวตนด้วยการสแกนใบหน้าสด?\n\n" +
          "• guest จะค้นรูปด้วยการอัปโหลด/เลือกรูปไม่ได้ — ต้องสแกนใบหน้าสดเท่านั้น\n" +
          "• ระบบสแกนสดยังอยู่ระหว่างพัฒนา ระหว่างนี้ guest จะยังค้นรูปไม่ได้จนกว่าจะพร้อม\n\n" +
          "ใช้กับงานที่ต้องแจกรูปเฉพาะเจ้าตัว (เช่น งานมอบของ/รับปริญญา) เท่านั้น",
      );
      if (!ok) return;
    }

    setError(null);
    startTransition(async () => {
      const res = await setLivenessRequired(eventId, next);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEnabled(next);
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
        Restricted distribution
      </h2>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <ShieldCheckIcon className="h-5 w-5 shrink-0 text-zinc-400 mt-0.5" strokeWidth={1.5} />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  ยืนยันตัวตนด้วยการสแกนใบหน้าสด
                </p>
                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  อยู่ระหว่างพัฒนา
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                แจกรูปเฉพาะเจ้าตัวที่สแกนหน้าสด (กันคนอื่นเอารูปคนในภาพมาค้น)
                เหมาะกับงานมอบของ/รับปริญญา — guest จะอัปโหลดรูปค้นไม่ได้เมื่อเปิด
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="ยืนยันตัวตนด้วยการสแกนใบหน้าสด"
            disabled={pending}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled
                ? "bg-emerald-500"
                : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ เปิดอยู่ — ตอนนี้ guest ยังค้นรูปไม่ได้จนกว่าระบบสแกนหน้าสดจะพร้อมใช้งาน
          </p>
        )}

        {error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    </section>
  );
}

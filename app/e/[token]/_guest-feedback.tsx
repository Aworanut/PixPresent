"use client";

import { useEffect, useState } from "react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { submitGuestFeedback } from "@/lib/actions/feedback";
import type { FeedbackSubmission } from "@/lib/feedback";

/**
 * Dismissible guest feedback card on the share-link landing. Mounted at page
 * level (does not touch the _face-search state machine). The "เจอรูปครบไหม?"
 * question self-reports the find-rate signal, so we needn't read search state.
 * Submission / dismissal is remembered per-event in localStorage so it doesn't
 * nag on refresh.
 */
export function GuestFeedback({
  eventId,
  shareToken,
}: {
  eventId: string;
  shareToken: string;
}) {
  const storageKey = `pp_fb_${eventId}`;
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);

  // Reveal after mount and read the per-event dismissal flag. setState is
  // deferred into a microtask (not called synchronously in the effect body) to
  // satisfy react-hooks/set-state-in-effect — the same convention used by the
  // admin drawers.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setMounted(true);
      try {
        setHidden(localStorage.getItem(storageKey) === "1");
      } catch {
        setHidden(false);
      }
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const remember = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore (private mode / storage disabled)
    }
  };

  if (!mounted || hidden) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ช่วยรีวิวประสบการณ์สั้นๆ ให้เราหน่อยได้ไหม? 🙏
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              ให้ความเห็น
            </button>
            <button
              type="button"
              onClick={() => {
                remember();
                setHidden(true);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              ไม่เป็นไร
            </button>
          </div>
        </div>
      ) : (
        <FeedbackForm
          audience="guest"
          submitLabel="ส่งความเห็น"
          onSubmit={async (s: FeedbackSubmission) => {
            const res = await submitGuestFeedback({ eventId, shareToken, ...s });
            if (res.ok) remember();
            return res;
          }}
        />
      )}
    </div>
  );
}

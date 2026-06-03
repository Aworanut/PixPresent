"use client";

import { useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { submitOrganizerFeedback } from "@/lib/actions/feedback";

/**
 * Persistent organizer feedback entry — a floating button in the dashboard that
 * opens a feedback modal. (Auto-prompt after an event completes is deferred.)
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        <ChatBubbleLeftRightIcon className="h-4 w-4" />
        ส่ง feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-label="ส่ง feedback"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                บอกเราหน่อย — ช่วยให้ PixPresent ดีขึ้น
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="ปิด"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <FeedbackForm
              audience="organizer"
              submitLabel="ส่ง feedback"
              onSubmit={submitOrganizerFeedback}
            />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { feedbackConfig, type FeedbackAudience } from "@/lib/feedback-questions";
import type { FeedbackSubmission } from "@/lib/feedback";

type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Shared feedback form. Renders the code-defined question set for an audience
 * (rating stars + extra single/text questions + a universal comment) and hands
 * a normalized submission to `onSubmit`. Used by the guest card and the
 * organizer widget.
 */
export function FeedbackForm({
  audience,
  onSubmit,
  submitLabel = "ส่ง",
}: {
  audience: FeedbackAudience;
  onSubmit: (submission: FeedbackSubmission) => Promise<SubmitResult>;
  submitLabel?: string;
}) {
  const cfg = feedbackConfig(audience);
  const [rating, setRating] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        ขอบคุณสำหรับความเห็น 🙏
      </div>
    );
  }

  const setAnswer = (id: string, value: string) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const submit = async () => {
    setError(null);
    setBusy(true);
    const res = await onSubmit({ rating, answers, comment });
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  };

  return (
    <div className="space-y-4">
      {/* Rating */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {cfg.ratingLabel}
        </p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? null : n)}
              aria-label={`${n} ดาว`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors ${
                rating !== null && n <= rating
                  ? "border-amber-400 bg-amber-50 text-amber-500 dark:border-amber-500/50 dark:bg-amber-950/30"
                  : "border-zinc-200 text-zinc-300 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-600 dark:hover:border-zinc-600"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Extra questions */}
      {cfg.questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {q.label}
          </p>
          {q.type === "single" ? (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setAnswer(q.id, answers[q.id] === opt.value ? "" : opt.value)
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    answers[q.id] === opt.value
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          )}
        </div>
      ))}

      {/* Universal comment */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {cfg.commentLabel}
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={cfg.commentPlaceholder}
          rows={3}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "กำลังส่ง…" : submitLabel}
      </button>
    </div>
  );
}

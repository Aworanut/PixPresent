// lib/feedback.ts
// Pure feedback validation/normalization — no Next imports, so Vitest can
// exercise it directly (mirrors lib/topup.ts / lib/credit-packages.ts).

import { extraQuestionIds, type FeedbackAudience } from "./feedback-questions";

export const COMMENT_MAX = 2000;

export type FeedbackSubmission = {
  rating: number | null;
  answers: Record<string, string>;
  comment: string;
};

export type FeedbackValidation =
  | { ok: true; value: FeedbackSubmission }
  | { ok: false; error: string };

/**
 * Validate + normalize a feedback submission for the given audience.
 * - rating, if present, must be an integer 1–5
 * - comment is trimmed and capped
 * - answers are filtered to this audience's known question ids, trimmed, and
 *   empties dropped
 * - a fully-empty submission is rejected (don't store noise)
 */
export function validateFeedback(
  audience: FeedbackAudience,
  raw: FeedbackSubmission,
): FeedbackValidation {
  const rating = raw.rating;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, error: "คะแนนต้องเป็นจำนวนเต็ม 1–5" };
  }

  const comment = (raw.comment ?? "").trim();
  if (comment.length > COMMENT_MAX) {
    return {
      ok: false,
      error: `ความเห็นยาวเกินไป (สูงสุด ${COMMENT_MAX} ตัวอักษร)`,
    };
  }

  const known = new Set(extraQuestionIds(audience));
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.answers ?? {})) {
    if (!known.has(key)) continue;
    const val = typeof value === "string" ? value.trim() : "";
    if (val) answers[key] = val;
  }

  const hasContent =
    rating !== null || comment.length > 0 || Object.keys(answers).length > 0;
  if (!hasContent) {
    return { ok: false, error: "กรุณาให้ข้อมูลอย่างน้อย 1 อย่าง" };
  }

  return { ok: true, value: { rating, answers, comment } };
}

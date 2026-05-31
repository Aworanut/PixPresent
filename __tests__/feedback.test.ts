import { describe, it, expect } from "vitest";
import { validateFeedback, COMMENT_MAX } from "@/lib/feedback";

const base = { rating: null, answers: {}, comment: "" };

describe("validateFeedback", () => {
  it("rejects a fully-empty submission", () => {
    const r = validateFeedback("guest", { ...base });
    expect(r.ok).toBe(false);
  });

  it("accepts a rating-only submission", () => {
    const r = validateFeedback("guest", { ...base, rating: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rating).toBe(4);
  });

  it("accepts a comment-only submission and trims it", () => {
    const r = validateFeedback("guest", { ...base, comment: "  เยี่ยม  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.comment).toBe("เยี่ยม");
  });

  it("accepts boundary ratings 1 and 5", () => {
    expect(validateFeedback("guest", { ...base, rating: 1 }).ok).toBe(true);
    expect(validateFeedback("guest", { ...base, rating: 5 }).ok).toBe(true);
  });

  it("rejects out-of-range ratings", () => {
    expect(validateFeedback("guest", { ...base, rating: 0 }).ok).toBe(false);
    expect(validateFeedback("guest", { ...base, rating: 6 }).ok).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    expect(validateFeedback("guest", { ...base, rating: 3.5 }).ok).toBe(false);
  });

  it("rejects an over-long comment", () => {
    const r = validateFeedback("guest", {
      ...base,
      comment: "x".repeat(COMMENT_MAX + 1),
    });
    expect(r.ok).toBe(false);
  });

  it("keeps known answers and drops unknown / empty ones", () => {
    const r = validateFeedback("guest", {
      ...base,
      answers: { found: "some", bogus: "x", empty: "   " },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual({ found: "some" });
  });

  it("uses the audience's own question set", () => {
    // `found` is a guest question, not an organizer one → dropped for organizer.
    const r = validateFeedback("organizer", {
      ...base,
      answers: { found: "all", love: "face search" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual({ love: "face search" });
  });
});

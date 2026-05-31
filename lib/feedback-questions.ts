// lib/feedback-questions.ts
// Code-defined feedback question set (Hybrid scope — see
// docs/superpowers/specs/2026-05-31-feedback-system-design.md).
//
// `rating` and `comment` are universal primitives rendered for every audience
// (and stored in dedicated columns). Anything else is an "extra" question stored
// in the response's JSONB `answers`, keyed by id. Bump FEEDBACK_QUESTIONS_VERSION
// whenever the set changes so responses stay interpretable over time.

export type FeedbackAudience = "guest" | "organizer";

export type ExtraQuestion =
  | {
      id: string;
      type: "single";
      label: string;
      options: { value: string; label: string }[];
    }
  | { id: string; type: "text"; label: string; placeholder?: string };

export type AudienceFeedbackConfig = {
  ratingLabel: string;
  commentLabel: string;
  commentPlaceholder?: string;
  questions: ExtraQuestion[];
};

export const FEEDBACK_QUESTIONS_VERSION = 1;

export const FEEDBACK_CONFIG: Record<FeedbackAudience, AudienceFeedbackConfig> = {
  guest: {
    ratingLabel: "ให้คะแนนประสบการณ์ค้นหารูป",
    commentLabel: "อยากบอกอะไรเพิ่มไหม?",
    commentPlaceholder: "ไม่บังคับ — เล่าได้เลย",
    questions: [
      {
        id: "found",
        type: "single",
        label: "เจอรูปของคุณครบไหม?",
        options: [
          { value: "all", label: "เจอครบ" },
          { value: "some", label: "เจอบางส่วน" },
          { value: "none", label: "ไม่เจอเลย" },
        ],
      },
    ],
  },
  organizer: {
    ratingLabel: "ให้คะแนน PixPresent โดยรวม (1–5)",
    commentLabel: "อะไรที่อยากให้ปรับปรุง / ติดขัดตรงไหน?",
    commentPlaceholder: "บอกตรงๆ ได้เลย ช่วยให้เราพัฒนา",
    questions: [
      {
        id: "love",
        type: "text",
        label: "ฟีเจอร์ไหนที่ชอบ / มีประโยชน์ที่สุด?",
        placeholder: "ไม่บังคับ",
      },
    ],
  },
};

export function feedbackConfig(audience: FeedbackAudience): AudienceFeedbackConfig {
  return FEEDBACK_CONFIG[audience];
}

export function extraQuestionIds(audience: FeedbackAudience): string[] {
  return FEEDBACK_CONFIG[audience].questions.map((q) => q.id);
}

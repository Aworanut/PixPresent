"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { validateFeedback, type FeedbackSubmission } from "@/lib/feedback";
import { FEEDBACK_QUESTIONS_VERSION } from "@/lib/feedback-questions";

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export async function submitGuestFeedback(
  input: { eventId: string; shareToken: string } & FeedbackSubmission,
): Promise<FeedbackResult> {
  const v = validateFeedback("guest", input);
  if (!v.ok) return { ok: false, error: v.error };

  const admin = createServiceRoleClient();

  // Tie feedback to a real share link (cheap anti-garbage check).
  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("id", input.eventId)
    .eq("share_token", input.shareToken)
    .is("deleted_at", null)
    .maybeSingle();
  if (!event) return { ok: false, error: "ลิงก์ไม่ถูกต้อง" };

  const { error } = await admin.from("feedback_responses").insert({
    source: "guest",
    event_id: event.id,
    rating: v.value.rating,
    answers: v.value.answers,
    comment: v.value.comment || null,
    questions_version: FEEDBACK_QUESTIONS_VERSION,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function submitOrganizerFeedback(
  input: FeedbackSubmission,
): Promise<FeedbackResult> {
  const v = validateFeedback("organizer", input);
  if (!v.ok) return { ok: false, error: v.error };

  const ctx = await getCurrentTenant();
  if (!ctx) return { ok: false, error: "unauthorized" };

  // Session client → the RLS policy enforces tenant_id = current_tenant_id().
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_responses").insert({
    source: "organizer",
    tenant_id: ctx.tenant.id,
    rating: v.value.rating,
    answers: v.value.answers,
    comment: v.value.comment || null,
    questions_version: FEEDBACK_QUESTIONS_VERSION,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

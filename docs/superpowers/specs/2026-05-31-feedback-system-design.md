# Feedback system (organizer + guest) — design

**Date:** 2026-05-31 · **Status:** accepted · **Subsystem:** C of the admin-management suite
**Branch:** `feature/admin-management`

## Problem

We are heading into the internal pilot (#18). To improve the product we need a
cheap, always-on way to capture signal from the two audiences who actually touch
it: **organizers** (tenant users) and **guests** (people who open a share link and
face-search). Today there is no feedback channel at all.

## Scope decision — Hybrid (user-chosen)

The question set is **defined in code** (`lib/feedback-questions.ts`) and rendered
as a small fixed form for now. Responses are stored with a **JSONB `answers`**
column so that promoting questions to a DB-driven, admin-editable config later
needs **no schema change** to the response table. We are explicitly NOT building a
survey builder now (YAGNI); the schema just refuses to block one.

Out of scope for this build (deferred, flagged for review):
- Admin-editable question builder UI.
- Auto-prompting organizers after an event completes (we ship a persistent entry
  point instead).
- Guest feedback rate-limiting / dedupe (behind a share link; acceptable for pilot).

## Data model

One append-only table.

```
feedback_responses
  id                uuid pk
  source            text  -- 'guest' | 'organizer'
  tenant_id         uuid null  -- organizer feedback
  event_id          uuid null  -- guest feedback
  guest_session_id  uuid null  -- guest feedback, when known
  rating            smallint null  -- 1..5 (promoted column for easy averaging)
  answers           jsonb      -- extra questions keyed by question id
  comment           text null  -- universal free-text
  questions_version smallint   -- which code-defined question set produced this
  meta              jsonb      -- reserved (page, UA hint, …)
  created_at        timestamptz
```

`rating` and `comment` are the two universal primitives (dedicated columns for
trivial aggregation/display). Everything else lives in `answers` JSONB.

### RLS
- **Organizer insert:** authenticated, `source='organizer' AND tenant_id = current_tenant_id()`.
- **Guest insert:** written server-side with the **service-role** client (RLS
  bypassed), mirroring `guest_sessions`/face-search. A cheap `event_id + share_token`
  check ties feedback to a real link.
- **Reads:** only the super-admin area, via the service-role client → no SELECT
  policy granted (deny-by-default; service-role bypasses).
- **Append-only:** no update/delete policies.

## Components / data flow

- `lib/feedback-questions.ts` — typed, code-defined question config per audience
  (universal rating + comment, plus extra `single`/`text` questions). Versioned.
- `lib/feedback.ts` — pure validation/normalization (no Next imports; Vitest-testable,
  mirrors `lib/topup.ts`). Rating range, comment cap, strips unknown answer keys,
  rejects empty submissions.
- `lib/actions/feedback.ts` — `submitGuestFeedback` (service-role) and
  `submitOrganizerFeedback` (session client → RLS).
- `components/feedback/feedback-form.tsx` — shared client form rendering the
  config (stars / option buttons / textarea) → calls an injected `onSubmit`.
- `app/e/[token]/_guest-feedback.tsx` — dismissible card on the guest landing
  (page-level mount; does NOT touch the `_face-search` state machine). The
  "เจอรูปครบไหม?" question self-reports the face-miss signal, so we need not read
  search state in code. Dismissal/submit remembered in `localStorage`.
- `app/dashboard/_feedback-widget.tsx` — floating "ส่ง feedback" button + modal,
  mounted once in the dashboard layout.
- `app/admin/feedback/page.tsx` — summary stat cards (counts, avg ratings) + recent
  responses list, source filter. New "Feedback" sidebar item.

## Testing
- Unit: `__tests__/feedback.test.ts` over `validateFeedback` (range, empty,
  comment cap, unknown-key stripping, boundaries).
- Type/lint: `tsc --noEmit`, eslint.
- Migration applied locally via `supabase migration up`; types regenerated.

## Existing-file edits (all additive, flagged for review)
- `app/e/[token]/page.tsx` — mount `<GuestFeedback>` (like `InAppBrowserNotice`).
- `app/dashboard/layout.tsx` — mount `<FeedbackWidget>`.
- `app/admin/_sidebar.tsx` — add "Feedback" nav item.
Nothing deleted; no existing logic changed.

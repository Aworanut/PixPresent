-- Feedback from organizers and guests, for product improvement (spec:
-- docs/superpowers/specs/2026-05-31-feedback-system-design.md).
--
-- Hybrid design: the question SET lives in code (lib/feedback-questions.ts) for
-- now; answers are stored as JSONB keyed by question id, so promoting questions
-- to a DB-driven, admin-editable config later requires NO schema change here.

create table if not exists public.feedback_responses (
  id                uuid primary key default gen_random_uuid(),
  source            text not null check (source in ('guest', 'organizer')),

  -- Attribution (all nullable — depends on source):
  --   organizer → tenant_id set; event_id / guest_session_id null
  --   guest     → event_id set (+ guest_session_id when available); tenant_id null
  tenant_id         uuid references public.tenants(id) on delete set null,
  event_id          uuid references public.events(id) on delete set null,
  guest_session_id  uuid references public.guest_sessions(id) on delete set null,

  rating            smallint check (rating between 1 and 5),
  answers           jsonb not null default '{}'::jsonb,
  comment           text,
  questions_version smallint not null default 1,
  meta              jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now()
);

comment on table public.feedback_responses is
  'Organizer + guest feedback for product improvement. Question set is code-defined (lib/feedback-questions.ts); answers JSONB keeps the schema stable if questions later become DB-driven/admin-editable.';

create index if not exists feedback_responses_source_created_idx
  on public.feedback_responses (source, created_at desc);
create index if not exists feedback_responses_event_idx
  on public.feedback_responses (event_id);
create index if not exists feedback_responses_tenant_idx
  on public.feedback_responses (tenant_id);

alter table public.feedback_responses enable row level security;

-- Organizers may submit feedback attributed only to their own tenant.
-- Guest feedback is inserted server-side via the service-role client (RLS
-- bypassed), mirroring guest_sessions / face-search. Reads happen only in the
-- super-admin area via the service-role client, so no SELECT policy is granted
-- (RLS denies by default; service-role bypasses). Append-only: no update/delete.
create policy "feedback_organizer_insert_own"
  on public.feedback_responses for insert
  to authenticated
  with check (
    source = 'organizer'
    and tenant_id = public.current_tenant_id()
  );

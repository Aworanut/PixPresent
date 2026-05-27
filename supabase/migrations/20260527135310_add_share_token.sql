-- =============================================================================
-- Guest share token on events (#9)
-- =============================================================================
-- Adds the per-event token + expiry needed for organizers to generate guest
-- links. The token doubles as the URL path segment (`/e/{token}`) and as
-- evidence of access on the server side.
--
-- share_link_expires_days stays as the default duration; share_token_expires_at
-- is the explicit timestamp set each time the link is (re)generated.
-- =============================================================================

alter table public.events
  add column if not exists share_token uuid,
  add column if not exists share_token_expires_at timestamptz;

-- Used to look up an event by token from the guest landing route (#10).
create unique index if not exists events_share_token_idx
  on public.events (share_token)
  where share_token is not null;

comment on column public.events.share_token is
  'Unguessable token used in /e/{token} guest URL. NULL when no link generated.';
comment on column public.events.share_token_expires_at is
  'Absolute expiry; null/past = link inactive. Driven by share_link_expires_days at generation time.';

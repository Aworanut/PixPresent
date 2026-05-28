-- supabase/migrations/20260528040000_event_tier.sql
-- =============================================================================
-- Event tier system (#12)
-- เพิ่ม tier columns ใน events + update credit_ledger reason constraint
-- =============================================================================

-- 1. เพิ่ม tier columns ใน events
alter table public.events
  add column tier               text not null default 'starter'
    check (tier in ('starter', 'gallery', 'studio')),
  add column storage_limit_gb   integer not null default 5
    check (storage_limit_gb > 0),
  add column link_active_days   integer not null default 3
    check (link_active_days > 0),
  add column data_retention_days integer not null default 7
    check (data_retention_days > 0);

comment on column public.events.tier is
  'Event tier: starter (199cr) | gallery (499cr) | studio (999cr)';
comment on column public.events.storage_limit_gb is
  'Max storage for this event in GB — set from tier at creation time';
comment on column public.events.link_active_days is
  'How long the guest share link is active after activation';
comment on column public.events.data_retention_days is
  'How long photos are kept after link expires';

-- Add index on tier column for efficient querying
create index events_tier_idx on public.events (tier);

-- 2. Update credit_ledger reason constraint เพื่อรองรับ welcome_bonus
alter table public.credit_ledger
  drop constraint if exists credit_ledger_reason_check,
  add constraint credit_ledger_reason_check
    check (reason in (
      'topup_slip',
      'activate_event',
      'refund',
      'adjustment',
      'welcome_bonus'
    ));

-- =============================================================================
-- Special tenant tier — account-level paid plan ('business')
--   First feature it unlocks: UNLIMITED data retention. Its events are skipped
--   by the cleanup-collections cron and never expire (see lib/tenant-plans.ts).
--   More features per ISSUES #B-06 later. Multi-member org + roles
--   (ADR 0004 "Stage 2") intentionally NOT included here — that is a separate,
--   heavier change to be built only after a concrete use case validates it.
-- =============================================================================

alter table public.tenants
  drop constraint if exists tenants_plan_check;

alter table public.tenants
  add constraint tenants_plan_check
  check (plan in ('free', 'starter', 'pro', 'business'));

comment on column public.tenants.plan is
  'Account-level plan. ''business'' = special tier (first feature: unlimited data retention). See lib/tenant-plans.ts and docs/adr/0004-*.';

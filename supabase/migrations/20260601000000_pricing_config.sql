-- DB-driven pricing/tier config (spec:
-- docs/superpowers/specs/2026-06-01-pricing-config-design.md).
--
-- Moves TOPUP_PACKAGES (lib/payment-config.ts) and TIER_CONFIG
-- (lib/credit-packages.ts) from code constants into editable DB rows so a
-- super-admin can adjust pricing + per-tier features without a redeploy.
--
-- The code constants stay as the SEED here and as a runtime fallback in
-- lib/pricing.ts: if these tables are empty/unreachable, behaviour == the
-- constants. Event creation still snapshots the tier config onto the event row
-- (create_event_deduct_credit), so price changes only affect NEW events.

create table if not exists public.topup_packages (
  id          text primary key,           -- 'pack_199' | 'pack_499' | 'pack_999'
  credits     integer not null check (credits > 0),
  price_thb   integer not null check (price_thb > 0),
  label       text not null,
  highlight   boolean not null default false,
  active      boolean not null default true,
  sort        integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.event_tiers (
  id                  text primary key,   -- 'starter' | 'gallery' | 'studio'
  credit_cost         integer not null check (credit_cost > 0),
  storage_limit_gb    integer not null check (storage_limit_gb > 0),
  link_active_days    integer not null check (link_active_days > 0),
  data_retention_days integer not null check (data_retention_days > 0),
  label               text not null,
  description         text not null default '',
  active              boolean not null default true,
  sort                integer not null default 0,
  updated_at          timestamptz not null default now()
);

-- Seed = current code constants (keep in sync if the constants change).
insert into public.topup_packages (id, credits, price_thb, label, highlight, sort) values
  ('pack_199', 199, 199, '199 Credits', false, 1),
  ('pack_499', 499, 499, '499 Credits', true,  2),
  ('pack_999', 999, 999, '999 Credits', false, 3)
on conflict (id) do nothing;

insert into public.event_tiers
  (id, credit_cost, storage_limit_gb, link_active_days, data_retention_days, label, description, sort) values
  ('starter', 199,  5, 3,  7,  'Starter', '5 GB · link 3 วัน · เก็บข้อมูล 7 วัน', 1),
  ('gallery', 499, 20, 5, 14,  'Gallery', '20 GB · link 5 วัน · เก็บข้อมูล 14 วัน', 2),
  ('studio',  999, 50, 7, 30,  'Studio',  '50 GB · link 7 วัน · เก็บข้อมูล 30 วัน · Highlight Reel', 3)
on conflict (id) do nothing;

-- Reads happen server-side via the service-role client (bypasses RLS). Writes
-- happen only in the super-admin area, also via service-role. RLS is enabled
-- with a read-only policy for authenticated users (future client reads); no
-- write policy is granted (service-role bypasses; nobody else may write).
alter table public.topup_packages enable row level security;
alter table public.event_tiers enable row level security;

create policy "topup_packages_read" on public.topup_packages
  for select to authenticated using (true);
create policy "event_tiers_read" on public.event_tiers
  for select to authenticated using (true);

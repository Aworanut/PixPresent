-- Promotions: bonus-credit campaigns redeemable at top-up (spec:
-- docs/superpowers/specs/2026-06-01-promotions-design.md).
--
-- Slip-based payment → a promo grants BONUS credits on a top-up (percent of the
-- transferred amount, or a fixed amount). Redemption is opt-in (organizer enters
-- a code), so a top-up with no code is completely unaffected.

create table if not exists public.promotions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,           -- entered by organizers (store uppercase)
  description      text not null default '',
  kind             text not null check (kind in ('percent', 'fixed')),
  value            integer not null check (value > 0),  -- percent (e.g. 20) or fixed bonus credits
  min_topup_thb    integer not null default 0 check (min_topup_thb >= 0),
  max_redemptions  integer check (max_redemptions is null or max_redemptions > 0),  -- null = unlimited
  per_tenant_limit integer not null default 1 check (per_tenant_limit > 0),
  redeemed_count   integer not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  id            uuid primary key default gen_random_uuid(),
  promo_id      uuid not null references public.promotions(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  slip_id       uuid references public.slip_uploads(id) on delete set null,
  bonus_credits integer not null,
  created_at    timestamptz not null default now()
);

create index if not exists promo_redemptions_promo_idx on public.promo_redemptions (promo_id);
create index if not exists promo_redemptions_tenant_idx on public.promo_redemptions (tenant_id);

-- Admin-managed + server-side redemption, all via the service-role client
-- (bypasses RLS). RLS is enabled with NO policies → no other role can read/write.
alter table public.promotions enable row level security;
alter table public.promo_redemptions enable row level security;

comment on table public.promotions is
  'Bonus-credit promo campaigns redeemed at top-up. Managed in /admin/promotions; redemption is opt-in via a code so the base top-up flow is unaffected when no code is used.';

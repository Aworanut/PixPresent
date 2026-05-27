-- =============================================================================
-- Initial Schema — Phase 1 (PixPresent / FaceFind)
-- =============================================================================
-- Covers:
--   §4    Core 6 tables (tenants, events, photographers, photos,
--         face_blacklist, guest_sessions)
--   #13   Credit system (slip_uploads, credit_ledger) + credit columns
--   §11   Commerce nullable prep cols (price, watermark_url, commerce_enabled,
--         purchased_photo_ids, payout_account_id)
--   §11.4 Highlight reel nullable prep cols (reel_quota, highlight_reel_*)
-- RLS policies live in the next migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Helper: super-admin check (read from JWT app_metadata)
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- =============================================================================
-- 1. tenants  (§4.1)
-- =============================================================================
create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  owner_user_id      uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  plan               text not null default 'free'
                       check (plan in ('free', 'starter', 'pro')),
  storage_provider   text not null default 'gdrive'
                       check (storage_provider in ('gdrive', 'dropbox')),
  -- credit system (#13)
  credit_balance     integer not null default 0
                       check (credit_balance >= 0),
  -- Phase 2 prep (§11)
  payout_account_id  uuid,
  payment_provider   text check (payment_provider in ('omise', 'stripe')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index tenants_owner_user_id_idx on public.tenants (owner_user_id);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2. events  (§4.2)
-- =============================================================================
create table public.events (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references public.tenants(id) on delete cascade,
  name                       text not null,
  event_date                 date,
  storage_folder_id          text,
  rekognition_collection_id  text,
  is_indexed                 boolean not null default false,
  share_link_expires_days    integer not null default 7
                               check (share_link_expires_days between 1 and 365),
  -- credit system (#13)
  activated_at               timestamptz,
  credits_used               integer not null default 0
                               check (credits_used >= 0),
  -- Phase 2 prep (§11 commerce)
  commerce_enabled           boolean not null default false,
  default_photo_price        numeric(10, 2),
  currency                   text default 'THB',
  -- Phase 2 prep (§11.4 highlight reel)
  reel_quota                 integer,
  highlight_reel_enabled     boolean not null default false,
  -- soft delete
  deleted_at                 timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index events_tenant_idx on public.events (tenant_id) where deleted_at is null;
create index events_activated_idx on public.events (tenant_id, activated_at)
  where deleted_at is null;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. photographers  (§4.3)
-- =============================================================================
create table public.photographers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  folder_id   text,
  created_at  timestamptz not null default now()
);

create index photographers_event_idx on public.photographers (event_id);

-- =============================================================================
-- 4. photos  (§4.4)
-- =============================================================================
create table public.photos (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events(id) on delete cascade,
  photographer_id       uuid references public.photographers(id) on delete set null,
  storage_file_id       text not null,
  r2_web_url            text,
  r2_full_url           text,
  rekognition_face_ids  text[] not null default '{}',
  indexed_at            timestamptz,
  -- Phase 2 prep (§11 commerce)
  price                 numeric(10, 2),
  watermark_url         text,
  created_at            timestamptz not null default now(),
  -- one row per (event, source file) — supports idempotent re-sync (#7)
  unique (event_id, storage_file_id)
);

create index photos_event_idx on public.photos (event_id);
-- GIN index over face_id array makes guest face-search filtering fast
create index photos_face_ids_idx on public.photos using gin (rekognition_face_ids);

-- =============================================================================
-- 5. face_blacklist  (§4.5)
-- =============================================================================
create table public.face_blacklist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  face_id     text not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (event_id, face_id)
);

create index face_blacklist_event_idx on public.face_blacklist (event_id);

-- =============================================================================
-- 6. guest_sessions  (§4.6)
-- =============================================================================
create table public.guest_sessions (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null references public.events(id) on delete cascade,
  selfie_r2_key          text,
  matched_photo_ids      uuid[] not null default '{}',
  -- PDPA consent timestamp (#15)
  consent_at             timestamptz,
  expires_at             timestamptz not null,
  -- Phase 2 prep (§11 commerce)
  purchased_photo_ids    uuid[] not null default '{}',
  -- Phase 2 prep (§11.4 highlight reel)
  highlight_reel_status  text
                           check (highlight_reel_status in
                             ('queued', 'processing', 'ready', 'failed')),
  highlight_reel_url     text,
  created_at             timestamptz not null default now()
);

create index guest_sessions_event_idx on public.guest_sessions (event_id);
create index guest_sessions_expires_idx on public.guest_sessions (expires_at);

-- =============================================================================
-- 7. slip_uploads  (#13)
-- =============================================================================
create table public.slip_uploads (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  package_id        text not null
                      check (package_id in ('starter', 'standard', 'pro', 'custom')),
  amount_thb        numeric(10, 2) not null check (amount_thb > 0),
  credits_claimed   integer not null check (credits_claimed > 0),
  slip_image_url    text not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  reject_reason     text,
  uploaded_at       timestamptz not null default now(),
  verified_at       timestamptz,
  verified_by       uuid references auth.users(id)
);

create index slip_uploads_tenant_idx on public.slip_uploads (tenant_id);
create index slip_uploads_status_idx
  on public.slip_uploads (status, uploaded_at desc);

-- =============================================================================
-- 8. credit_ledger  (#13 — append-only audit trail)
-- =============================================================================
create table public.credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  delta           integer not null,
  balance_after   integer not null check (balance_after >= 0),
  reason          text not null
                    check (reason in ('topup_slip', 'activate_event',
                                      'refund', 'adjustment')),
  ref_id          uuid,
  note            text,
  created_at      timestamptz not null default now()
);

create index credit_ledger_tenant_idx
  on public.credit_ledger (tenant_id, created_at desc);

-- Append-only: no UPDATE/DELETE policy in RLS migration → only service role can.
-- That, combined with the table being write-via-RPC, gives an immutable ledger.

-- =============================================================================
-- Comments (schema documentation surfaced in Supabase Studio)
-- =============================================================================
comment on table public.tenants is 'Organizer accounts (one per signup, FK to auth.users)';
comment on table public.events is 'Photo events organized by a tenant. Soft-deleted via deleted_at.';
comment on table public.photographers is 'Per-event photographer roster + their Drive sub-folder';
comment on table public.photos is 'Indexed photos with R2 URLs + Rekognition face IDs';
comment on table public.face_blacklist is 'Per-event face IDs to exclude from guest results';
comment on table public.guest_sessions is 'Guest face-search sessions (token-based, expiring)';
comment on table public.slip_uploads is 'Manual bank-transfer slips awaiting admin verification';
comment on table public.credit_ledger is 'Append-only audit trail of every credit movement';

-- =============================================================================
-- Person Archive — cross-event face-searchable people index (#23)
-- =============================================================================
-- Internal-facing capability (gated behind the business tier in app code). Lets
-- an organizer register named people (a roster) and find every photo of a given
-- person across all events and years. Reuses the existing per-event Rekognition
-- collections; does NOT touch the guest face-search flow.
--   spec: docs/superpowers/specs/2026-06-03-person-archive-face-search-design.md
--
-- Every table carries a denormalized tenant_id so RLS uses the same simple
-- `tenant_id = current_tenant_id()` pattern as events. Engine + enrollment
-- writes go through the service role (bypasses RLS), like the guest/ledger flows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- people — the roster
-- -----------------------------------------------------------------------------
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index people_tenant_idx on public.people (tenant_id);

-- -----------------------------------------------------------------------------
-- person_reference_faces — reference face crops per person (many per person)
--   source='tagged'   → cropped from an existing photo (source_photo_id + bbox)
--   source='uploaded' → an image uploaded directly as a reference
-- -----------------------------------------------------------------------------
create table public.person_reference_faces (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  person_id       uuid not null references public.people(id) on delete cascade,
  source          text not null check (source in ('tagged', 'uploaded')),
  source_photo_id uuid references public.photos(id) on delete set null,
  bbox            jsonb,
  r2_key          text not null,
  created_at      timestamptz not null default now()
);

create index person_reference_faces_person_idx
  on public.person_reference_faces (person_id);

-- -----------------------------------------------------------------------------
-- photo_people — the index: which person appears in which photo (the heart)
--   status='pending' rows are low-confidence matches awaiting human review.
--   unique(person_id, photo_id) makes the matching engine's upsert idempotent.
-- -----------------------------------------------------------------------------
create table public.photo_people (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  photo_id    uuid not null references public.photos(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  confidence  real,
  matched_by  text not null check (matched_by in ('scan', 'manual')),
  status      text not null default 'confirmed' check (status in ('confirmed', 'pending')),
  created_at  timestamptz not null default now(),
  unique (person_id, photo_id)
);

create index photo_people_person_idx  on public.photo_people (person_id);
create index photo_people_event_idx   on public.photo_people (event_id);
create index photo_people_pending_idx on public.photo_people (person_id) where status = 'pending';

-- -----------------------------------------------------------------------------
-- person_event_scans — resumable work cursor for the matching engine.
--   One row per (person × event) unit; the scan route claims pending units
--   inside a 60s window and re-runs until none remain (same pattern as sync).
-- -----------------------------------------------------------------------------
create table public.person_event_scans (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  person_id       uuid not null references public.people(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'done', 'error')),
  photos_matched  integer not null default 0,
  error           text,
  last_run_at     timestamptz,
  unique (person_id, event_id)
);

create index person_event_scans_pending_idx
  on public.person_event_scans (tenant_id, status)
  where status = 'pending';

-- =============================================================================
-- RLS — organizer scoped to own tenant via current_tenant_id().
-- Service role bypasses RLS (engine + enrollment writes). No anon policies:
-- this is an internal dashboard tool, never exposed to guests.
-- =============================================================================
alter table public.people                 enable row level security;
alter table public.person_reference_faces enable row level security;
alter table public.photo_people           enable row level security;
alter table public.person_event_scans     enable row level security;

create policy "people_organizer_all"
  on public.people for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "person_reference_faces_organizer_all"
  on public.person_reference_faces for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "photo_people_organizer_all"
  on public.photo_people for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "person_event_scans_organizer_all"
  on public.person_event_scans for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Force RLS for the table owner too (matches the rest of the schema).
alter table public.people                 force row level security;
alter table public.person_reference_faces force row level security;
alter table public.photo_people           force row level security;
alter table public.person_event_scans     force row level security;

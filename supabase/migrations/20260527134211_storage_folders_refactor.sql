-- =============================================================================
-- Storage folders refactor
-- =============================================================================
-- Schema pivot: drop per-photographer model in favor of multi-folder-per-event.
--
-- Rationale:
--   • Real-world workflow: organizer creates ONE folder, shares editor access
--     with N photographers — they upload directly. No need for per-photographer
--     sub-folders or roster tracking.
--   • EXIF metadata + manual entry on commerce reports cover attribution.
--   • Multi-folder support handles multi-team events (main, drone, video, etc.).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop photographers
-- -----------------------------------------------------------------------------
-- photos.photographer_id has ON DELETE SET NULL FK → safe to drop the column
-- first, then drop the table.
alter table public.photos drop column if exists photographer_id;
drop table if exists public.photographers cascade;

-- -----------------------------------------------------------------------------
-- 2. Create event_storage_folders (one row per Drive folder)
-- -----------------------------------------------------------------------------
create table public.event_storage_folders (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  label       text not null default '',
  folder_id   text not null,
  created_at  timestamptz not null default now(),
  -- Same folder shouldn't be added twice to the same event.
  unique (event_id, folder_id)
);

create index event_storage_folders_event_idx
  on public.event_storage_folders (event_id);

-- -----------------------------------------------------------------------------
-- 3. Migrate existing data
-- -----------------------------------------------------------------------------
-- Preserve any single-folder values that organizers already set.
insert into public.event_storage_folders (event_id, label, folder_id)
  select id, '', storage_folder_id
  from public.events
  where storage_folder_id is not null
    and storage_folder_id <> '';

-- -----------------------------------------------------------------------------
-- 4. Drop the obsolete column on events
-- -----------------------------------------------------------------------------
alter table public.events drop column if exists storage_folder_id;

-- -----------------------------------------------------------------------------
-- 5. RLS — same organizer-scoped pattern as photographers used to use
-- -----------------------------------------------------------------------------
alter table public.event_storage_folders enable row level security;
alter table public.event_storage_folders force row level security;

create policy "event_storage_folders_organizer_all"
  on public.event_storage_folders for all
  using (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  )
  with check (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  );

-- -----------------------------------------------------------------------------
-- Docs
-- -----------------------------------------------------------------------------
comment on table public.event_storage_folders is
  'Multi-folder Drive sources per event. Organizer adds one row per folder with optional label.';

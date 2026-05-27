-- =============================================================================
-- Sync & Index prep (#7)
-- =============================================================================
-- Adds columns needed before #7 (Sync & Index) can run:
--   1. tenants.google_refresh_token — encrypted refresh token from OAuth
--   2. tenants.google_connected_at  — when the organizer connected Drive
--   3. photos.storage_file_id index — faster "already indexed?" check
--   4. events.sync_started_at / sync_completed_at — progress tracking
-- =============================================================================

-- 1. Google OAuth refresh token on tenants table
alter table public.tenants
  add column if not exists google_refresh_token text,
  add column if not exists google_connected_at timestamptz;

comment on column public.tenants.google_refresh_token is
  'Organizer Google OAuth refresh token for Drive read access. Encrypted at rest by Supabase Vault in production (#7).';
comment on column public.tenants.google_connected_at is
  'When the organizer last authorized Google Drive access.';

-- 2. Sync progress tracking on events
alter table public.events
  add column if not exists sync_started_at timestamptz,
  add column if not exists sync_completed_at timestamptz,
  add column if not exists sync_photo_count int not null default 0;

comment on column public.events.sync_started_at is
  'When the last Sync & Index job was started.';
comment on column public.events.sync_completed_at is
  'When the last Sync & Index job finished (null if still running or not yet started).';
comment on column public.events.sync_photo_count is
  'Number of photos processed in the last completed sync.';

-- 3. Index on storage_file_id for fast "already indexed?" look-up
create index if not exists photos_storage_file_id_idx
  on public.photos (storage_file_id);

-- 4. Index on event_id + indexed_at for re-sync (only process new files)
create index if not exists photos_event_indexed_idx
  on public.photos (event_id, indexed_at)
  where indexed_at is not null;

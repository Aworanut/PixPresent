-- =============================================================================
-- Dropbox as a second storage source
-- =============================================================================
-- • event_storage_folders gains a per-folder source_type discriminator so one
--   event can mix Google Drive + Dropbox folders.
-- • The dedup uniqueness moves from (event_id, folder_id) to
--   (event_id, source_type, folder_id) — a Drive folder id and a Dropbox path
--   never collide, but this is the correct normalized key.
-- • tenants gains Dropbox OAuth columns, mirroring the existing google_* pair.
-- =============================================================================

-- 1. Per-folder source discriminator (existing rows are all Google Drive).
alter table public.event_storage_folders
  add column source_type text not null default 'gdrive'
    check (source_type in ('gdrive', 'dropbox'));

-- 2. Swap the uniqueness key to include source_type.
alter table public.event_storage_folders
  drop constraint if exists event_storage_folders_event_id_folder_id_key;
alter table public.event_storage_folders
  add constraint event_storage_folders_event_source_folder_key
    unique (event_id, source_type, folder_id);

-- 3. Dropbox OAuth token storage on tenants (mirror google_refresh_token).
alter table public.tenants
  add column dropbox_refresh_token text,
  add column dropbox_connected_at  timestamptz;

comment on column public.event_storage_folders.source_type is
  'Which storage provider this folder lives in: gdrive | dropbox.';

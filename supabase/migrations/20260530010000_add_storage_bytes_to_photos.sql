-- supabase/migrations/20260530010000_add_storage_bytes_to_photos.sql
-- =============================================================================
-- Track per-photo R2 storage usage for quota enforcement (#storage-cap)
-- =============================================================================
-- Adds storage_bytes (web + full combined) to photos table.
-- Populated at sync time; used to enforce events.storage_limit_gb per tier.
-- Existing photos default to 0 — quota only enforced on newly-synced photos.
-- =============================================================================

ALTER TABLE public.photos
  ADD COLUMN storage_bytes BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.photos.storage_bytes IS
  'Combined R2 storage used by this photo (web + full variants) in bytes. '
  'Populated at sync time. Used for per-event storage quota enforcement against events.storage_limit_gb.';

-- Index to make SUM() fast per event
CREATE INDEX photos_event_storage_bytes_idx ON public.photos (event_id, storage_bytes);

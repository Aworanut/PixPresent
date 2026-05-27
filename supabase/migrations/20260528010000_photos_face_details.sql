-- =============================================================================
-- Face bounding-box storage for Blacklist Manager (#8)
-- =============================================================================
-- face_details stores the IndexFaces result per photo as:
-- [{ face_id: string, bbox: { left, top, width, height } (0-1 fractions) }]
-- Populated during sync; empty array for photos synced before this migration.
-- =============================================================================

alter table public.photos
  add column if not exists face_details jsonb not null default '[]'::jsonb;

comment on column public.photos.face_details is
  'Array of {face_id, bbox:{left,top,width,height}} from Rekognition IndexFaces. Used by the blacklist viewer to draw bounding boxes.';

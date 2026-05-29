-- =============================================================================
-- Event cover URL + tenant social/bio fields
-- Crop is baked into image files at upload (no zoom/position columns)
-- =============================================================================

alter table public.events
  add column if not exists cover_image_url text;

comment on column public.events.cover_image_url is 'Event cover photo banner URL (stored in avatars bucket)';

alter table public.tenants
  add column if not exists line_id text,
  add column if not exists instagram_username text,
  add column if not exists facebook_url text,
  add column if not exists bio text;

comment on column public.tenants.line_id is 'Optional Line ID for client business card contact';
comment on column public.tenants.instagram_username is 'Optional Instagram account name (excluding @)';
comment on column public.tenants.facebook_url is 'Optional Facebook page link';
comment on column public.tenants.bio is 'Optional brief photographer bio / studio description';

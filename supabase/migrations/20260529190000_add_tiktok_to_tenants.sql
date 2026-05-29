-- =============================================================================
-- Add TikTok Account Username to Tenants Table
-- =============================================================================

alter table public.tenants
  add column if not exists tiktok_username text;

comment on column public.tenants.tiktok_username is 'Photographer TikTok account username (without @)';

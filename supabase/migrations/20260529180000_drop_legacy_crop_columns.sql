-- =============================================================================
-- Drop legacy CSS crop columns (replaced by server-side crop at upload)
-- Safe no-op on fresh DBs; cleans up DBs that ran an earlier 291700 draft
-- =============================================================================

alter table public.events
  drop column if exists cover_zoom,
  drop column if exists cover_position_x,
  drop column if exists cover_position_y;

alter table public.tenants
  drop column if exists avatar_zoom,
  drop column if exists avatar_position_x,
  drop column if exists avatar_position_y;

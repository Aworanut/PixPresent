-- Replace binary is_hidden with 3-state visibility
-- 'public'     → เผยแพร่ทั้งหมด (show to all guests)
-- 'match_only' → เฉพาะใบหน้าตรง (show only when face matches) — default
-- 'hidden'     → ไม่เผยแพร่ (hidden from all guests)

alter table public.photos
  add column if not exists visibility text not null default 'match_only'
  check (visibility in ('public', 'match_only', 'hidden'));

-- Backfill: is_hidden=true → 'hidden', is_hidden=false stays 'match_only'
update public.photos
  set visibility = 'hidden'
  where is_hidden = true;

-- Drop legacy column + index
alter table public.photos
  drop column if exists is_hidden;

drop index if exists photos_event_hidden_idx;

-- New index for visibility queries
create index if not exists photos_event_visibility_idx
  on public.photos (event_id, visibility);

-- Add is_hidden flag for photo-level ban (organizer can see, guests cannot)
alter table public.photos
  add column if not exists is_hidden boolean not null default false;

create index if not exists photos_event_hidden_idx
  on public.photos (event_id, is_hidden);

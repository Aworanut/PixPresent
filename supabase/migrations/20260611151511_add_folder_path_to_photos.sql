-- Archive folder browse: relative subfolder path of each photo within its
-- connected source folder (e.g. 'พิธีเช้า/ช่วงเช้า'). '' = root of the folder.
-- The folder tree in the UI is derived from distinct prefixes of this column.
alter table public.photos
  add column folder_path text not null default '';

create index photos_event_folder_path_idx
  on public.photos (event_id, folder_path);

-- =============================================================================
-- Add analytics fields to photos table (Photo Name, Taken/Modified Date, EXIF Artist, EXIF Copyright)
-- =============================================================================

ALTER TABLE public.photos 
  ADD COLUMN original_filename TEXT,
  ADD COLUMN taken_at TIMESTAMPTZ,
  ADD COLUMN photographer_name TEXT,
  ADD COLUMN copyright TEXT,
  ADD COLUMN event_storage_folder_id UUID REFERENCES public.event_storage_folders(id) ON DELETE SET NULL;

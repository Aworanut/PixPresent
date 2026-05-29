-- =============================================================================
-- Tenant profile fields + post-signup onboarding (#onboarding)
-- =============================================================================

alter table public.tenants
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.tenants.first_name is 'Organizer given name — required after onboarding';
comment on column public.tenants.last_name is 'Organizer family name — required after onboarding';
comment on column public.tenants.display_name is 'Optional public display name for dashboard header';
comment on column public.tenants.phone is 'Optional contact phone number';
comment on column public.tenants.avatar_url is 'Profile photo URL (Supabase Storage or OAuth provider)';
comment on column public.tenants.onboarding_completed_at is
  'NULL until organizer completes post-signup profile form';

-- Existing tenants skip onboarding
update public.tenants
set onboarding_completed_at = created_at
where onboarding_completed_at is null;

-- Avatars bucket (public read for dashboard header)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

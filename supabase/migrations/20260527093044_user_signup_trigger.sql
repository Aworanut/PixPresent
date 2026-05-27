-- =============================================================================
-- Auto-provision tenant on user signup (#4)
-- =============================================================================
-- When a new row is inserted into auth.users we automatically create a
-- matching tenant row owned by that user. The organization name is taken from
-- raw_user_meta_data.organization_name (set by the client during signUp), with
-- a fallback to the local-part of the email.
--
-- SECURITY DEFINER lets this run with elevated rights regardless of whether
-- the session is fully established (relevant when email confirmation is on).
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenants (owner_user_id, name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Auto-creates a public.tenants row each time a new auth.users row is inserted.';

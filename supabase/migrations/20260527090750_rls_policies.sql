-- =============================================================================
-- RLS Policies — Phase 1
-- =============================================================================
-- Defaults & rules of thumb
--   • Service role bypasses RLS (used by Next.js API routes for guest flow
--     and ledger writes — see #7, #10, #13).
--   • Organizer (authenticated, role = 'authenticated') is scoped to their
--     own tenant via owner_user_id.
--   • Super admin (app_metadata.is_super_admin = true) can read everything
--     for slip verification (#19) and update slip status.
--   • Guest flow goes through Next.js API with service role, so anon needs
--     no policies on photos/events/etc. Keep tables locked tight.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: current authenticated user's tenant id (returns NULL for anon)
-- -----------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants
  where owner_user_id = auth.uid()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
alter table public.tenants enable row level security;

create policy "tenants_select_own_or_admin"
  on public.tenants for select
  using (owner_user_id = auth.uid() or public.is_super_admin());

create policy "tenants_insert_self"
  on public.tenants for insert
  with check (owner_user_id = auth.uid());

create policy "tenants_update_own"
  on public.tenants for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- No DELETE policy → tenants can't be deleted by users (cascades on auth.users delete)

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
alter table public.events enable row level security;

create policy "events_organizer_all"
  on public.events for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "events_super_admin_read"
  on public.events for select
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- photographers
-- -----------------------------------------------------------------------------
alter table public.photographers enable row level security;

create policy "photographers_organizer_all"
  on public.photographers for all
  using (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  )
  with check (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  );

-- -----------------------------------------------------------------------------
-- photos
-- -----------------------------------------------------------------------------
alter table public.photos enable row level security;

create policy "photos_organizer_all"
  on public.photos for all
  using (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  )
  with check (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  );

-- Note: guest gallery reads photos via Next.js API (service role) — see #11.
-- We deliberately do NOT expose photos to anon role via PostgREST.

-- -----------------------------------------------------------------------------
-- face_blacklist
-- -----------------------------------------------------------------------------
alter table public.face_blacklist enable row level security;

create policy "face_blacklist_organizer_all"
  on public.face_blacklist for all
  using (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  )
  with check (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  );

-- -----------------------------------------------------------------------------
-- guest_sessions
-- -----------------------------------------------------------------------------
alter table public.guest_sessions enable row level security;

-- Organizer can audit sessions on their events
create policy "guest_sessions_organizer_read"
  on public.guest_sessions for select
  using (
    event_id in (
      select id from public.events
      where tenant_id = public.current_tenant_id()
    )
  );

-- INSERT/UPDATE go through Next.js API (service role). No anon policy.

-- -----------------------------------------------------------------------------
-- slip_uploads (#13, #19)
-- -----------------------------------------------------------------------------
alter table public.slip_uploads enable row level security;

create policy "slip_uploads_organizer_read"
  on public.slip_uploads for select
  using (
    tenant_id = public.current_tenant_id()
    or public.is_super_admin()
  );

-- Organizer can submit slips for their own tenant, only as pending.
create policy "slip_uploads_organizer_insert"
  on public.slip_uploads for insert
  with check (
    tenant_id = public.current_tenant_id()
    and status = 'pending'
  );

-- Only super admin can update (approve / reject) — write path goes via RPC.
create policy "slip_uploads_super_admin_update"
  on public.slip_uploads for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- credit_ledger (#13 — append-only)
-- -----------------------------------------------------------------------------
alter table public.credit_ledger enable row level security;

create policy "credit_ledger_organizer_read"
  on public.credit_ledger for select
  using (
    tenant_id = public.current_tenant_id()
    or public.is_super_admin()
  );

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- All writes must use service role inside a transaction (#13).
-- This is what makes the ledger immutable from the client's perspective.

-- =============================================================================
-- Force RLS on for table owner too (safer default for super_admin-owned tables)
-- =============================================================================
alter table public.tenants        force row level security;
alter table public.events         force row level security;
alter table public.photographers  force row level security;
alter table public.photos         force row level security;
alter table public.face_blacklist force row level security;
alter table public.guest_sessions force row level security;
alter table public.slip_uploads   force row level security;
alter table public.credit_ledger  force row level security;

-- supabase/migrations/20260528060000_slip_topup_rpc.sql
-- =============================================================================
-- #13 Slip Upload + Credit Ledger — RPC functions
--   1a. Fix slip_uploads.package_id constraint (wrong values in initial schema)
--   1b. approve_topup_credit RPC  (atomic: approve slip → credit balance → ledger)
--   1c. reject_topup RPC          (atomic: reject slip with reason)
-- =============================================================================


-- =============================================================================
-- 1a. Fix slip_uploads.package_id CHECK constraint
--     Old values: 'starter','standard','pro','custom'
--     Correct values: 'pack_199','pack_499','pack_999','custom'
-- =============================================================================

alter table public.slip_uploads
  drop constraint slip_uploads_package_id_check,
  add  constraint slip_uploads_package_id_check
    check (package_id in ('pack_199', 'pack_499', 'pack_999', 'custom'));


-- =============================================================================
-- 1b. approve_topup_credit(p_slip_id uuid)
--     Called after SlipOK verification passes.
--     Atomically: approves slip → updates tenant balance → writes ledger entry.
--     credits_claimed is read from the locked slip row, not from a parameter.
-- =============================================================================

create or replace function public.approve_topup_credit(
  p_slip_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip    slip_uploads%rowtype;
  v_balance integer;
begin
  -- 1. Lock slip row; verify it exists and is still pending
  select *
    into v_slip
    from public.slip_uploads
   where id = p_slip_id
     for update;

  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;

  if v_slip.status <> 'pending' then
    raise exception 'slip_not_pending: slip_id=% is not in pending status', p_slip_id;
  end if;

  -- 2. Mark slip approved
  update public.slip_uploads
     set status      = 'approved',
         verified_at = now()
   where id = p_slip_id;

  -- 3. Lock tenant row and read current balance
  select credit_balance
    into v_balance
    from public.tenants
   where id = v_slip.tenant_id
     for update;

  if not found then
    raise exception 'tenant_not_found: tenant_id=% does not exist', v_slip.tenant_id;
  end if;

  -- 4. Compute new balance using credits_claimed from the slip row
  v_balance := v_balance + v_slip.credits_claimed;

  -- 5. Update tenant credit balance
  update public.tenants
     set credit_balance = v_balance
   where id = v_slip.tenant_id;

  -- 6. Append ledger entry
  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note)
  values
    (v_slip.tenant_id, v_slip.credits_claimed, v_balance, 'topup_slip', p_slip_id,
     'Auto-approved via SlipOK');
end;
$$;

comment on function public.approve_topup_credit(uuid) is
  'Atomically approves a pending slip_uploads row and credits the tenant balance. '
  'credits_claimed is read from the slip row itself — no caller-supplied amount. '
  'Must be called from service-role only (execute revoked from public/anon/authenticated).';

-- Revoke execute from all default roles; only service_role (SECURITY DEFINER owner) may call
revoke execute on function public.approve_topup_credit(uuid) from public;
revoke execute on function public.approve_topup_credit(uuid) from anon;
revoke execute on function public.approve_topup_credit(uuid) from authenticated;


-- =============================================================================
-- 1c. reject_topup(p_slip_id uuid, p_reason text)
--     Atomically marks a pending slip as rejected with a reason.
-- =============================================================================

create or replace function public.reject_topup(
  p_slip_id uuid,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Lock slip row; verify it exists
  perform 1
    from public.slip_uploads
   where id = p_slip_id
     for update;

  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;

  -- 2. Verify still pending (guard against double-processing)
  perform 1
    from public.slip_uploads
   where id     = p_slip_id
     and status = 'pending';

  if not found then
    raise exception 'slip_not_pending: slip_id=% is not in pending status', p_slip_id;
  end if;

  -- 3. Mark slip rejected
  update public.slip_uploads
     set status        = 'rejected',
         reject_reason = p_reason,
         verified_at   = now()
   where id = p_slip_id;
end;
$$;

comment on function public.reject_topup(uuid, text) is
  'Atomically rejects a pending slip_uploads row with a reason. '
  'Must be called from service-role only (execute revoked from public/anon/authenticated).';

-- Revoke execute from all default roles; only service_role (SECURITY DEFINER owner) may call
revoke execute on function public.reject_topup(uuid, text) from public;
revoke execute on function public.reject_topup(uuid, text) from anon;
revoke execute on function public.reject_topup(uuid, text) from authenticated;

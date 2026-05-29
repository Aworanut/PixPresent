-- =============================================================================
-- #19 Admin dashboard — attributable ledger + manual credit adjustment
--   1. credit_ledger.actor_user_id (who made a manual movement; NULL = system)
--   2. approve_topup_credit / reject_topup gain p_actor (manual = attributable)
--   3. adjust_credit RPC (reason 'adjustment', always attributed to a Super Admin)
-- =============================================================================

-- 1. Ledger actor -------------------------------------------------------------
alter table public.credit_ledger
  add column actor_user_id uuid references auth.users(id);

comment on column public.credit_ledger.actor_user_id is
  'Super Admin who performed a manual movement (adjustment / manual approve / manual reject). NULL = system or SlipOK auto.';

-- 2. Replace approve/reject with actor-aware signatures -----------------------
drop function if exists public.approve_topup_credit(uuid);
drop function if exists public.reject_topup(uuid, text);

create or replace function public.approve_topup_credit(
  p_slip_id uuid,
  p_actor   uuid default null
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
  select * into v_slip from public.slip_uploads where id = p_slip_id for update;
  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;
  if v_slip.status <> 'pending' then
    raise exception 'slip_not_pending: slip_id=% is not in pending status', p_slip_id;
  end if;

  -- p_actor NULL => auto-approved by SlipOK; non-NULL => manual admin reviewer
  update public.slip_uploads
     set status = 'approved', verified_at = now(), verified_by = p_actor
   where id = p_slip_id;

  select credit_balance into v_balance from public.tenants
   where id = v_slip.tenant_id for update;
  if not found then
    raise exception 'tenant_not_found: tenant_id=% does not exist', v_slip.tenant_id;
  end if;

  v_balance := v_balance + v_slip.credits_claimed;

  update public.tenants set credit_balance = v_balance where id = v_slip.tenant_id;

  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note, actor_user_id)
  values
    (v_slip.tenant_id, v_slip.credits_claimed, v_balance, 'topup_slip', p_slip_id,
     case when p_actor is null then 'Auto-approved via SlipOK'
          else 'Manually approved by Super Admin' end,
     p_actor);
end;
$$;

comment on function public.approve_topup_credit(uuid, uuid) is
  'Approves a pending slip and credits the tenant. p_actor NULL = SlipOK auto; non-NULL = manual admin. Service-role only.';

revoke execute on function public.approve_topup_credit(uuid, uuid) from public;
revoke execute on function public.approve_topup_credit(uuid, uuid) from anon;
revoke execute on function public.approve_topup_credit(uuid, uuid) from authenticated;

create or replace function public.reject_topup(
  p_slip_id uuid,
  p_reason  text,
  p_actor   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip slip_uploads%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'reject_topup: reason must not be empty';
  end if;

  select * into v_slip from public.slip_uploads where id = p_slip_id for update;
  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;
  if v_slip.status <> 'pending' then
    raise exception 'slip_not_pending: slip_id=% is already %', p_slip_id, v_slip.status;
  end if;

  update public.slip_uploads
     set status = 'rejected', reject_reason = p_reason, verified_at = now(), verified_by = p_actor
   where id = p_slip_id;
end;
$$;

comment on function public.reject_topup(uuid, text, uuid) is
  'Rejects a pending slip with a reason. p_actor = admin who rejected (NULL = auto). Service-role only.';

revoke execute on function public.reject_topup(uuid, text, uuid) from public;
revoke execute on function public.reject_topup(uuid, text, uuid) from anon;
revoke execute on function public.reject_topup(uuid, text, uuid) from authenticated;

-- 3. adjust_credit ------------------------------------------------------------
create or replace function public.adjust_credit(
  p_tenant_id uuid,
  p_delta     integer,
  p_note      text,
  p_actor     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_actor is null then
    raise exception 'adjust_credit: actor (Super Admin) is required';
  end if;
  if p_note is null or trim(p_note) = '' then
    raise exception 'adjust_credit: note must not be empty';
  end if;
  if p_delta = 0 then
    raise exception 'adjust_credit: delta must be non-zero';
  end if;

  select credit_balance into v_balance from public.tenants
   where id = p_tenant_id for update;
  if not found then
    raise exception 'tenant_not_found: tenant_id=% does not exist', p_tenant_id;
  end if;

  v_balance := v_balance + p_delta;
  if v_balance < 0 then
    raise exception 'insufficient_balance: adjustment would make balance negative';
  end if;

  update public.tenants set credit_balance = v_balance where id = p_tenant_id;

  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note, actor_user_id)
  values
    (p_tenant_id, p_delta, v_balance, 'adjustment', null, p_note, p_actor);
end;
$$;

comment on function public.adjust_credit(uuid, integer, text, uuid) is
  'Manual credit adjustment by a Super Admin. delta may be + or -. Writes an attributable adjustment ledger row. Service-role only.';

revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from public;
revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from anon;
revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from authenticated;

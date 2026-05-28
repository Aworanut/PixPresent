-- supabase/migrations/20260528070000_event_credit_rpc.sql
-- =============================================================================
-- #14 Credit Balance UI + Event Activation — RPC functions
--   1. create_event_deduct_credit  (atomic: create event → deduct credit → ledger)
--   2. delete_event_with_refund    (atomic: soft-delete event → optional refund → ledger)
-- =============================================================================


-- =============================================================================
-- 1. create_event_deduct_credit(...)
--    Called when a tenant activates a new event.
--    Atomically: locks tenant → checks balance → creates event → debits balance → writes ledger.
--    Returns the new event's UUID.
-- =============================================================================

create or replace function public.create_event_deduct_credit(
  p_tenant_id           uuid,
  p_name                text,
  p_event_date          date,
  p_tier                text,
  p_storage_limit_gb    integer,
  p_link_active_days    integer,
  p_data_retention_days integer,
  p_credit_cost         integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant   tenants%rowtype;
  v_event_id uuid;
  v_new_bal  integer;
begin
  -- 1. Lock tenant row
  select *
    into v_tenant
    from public.tenants
   where id = p_tenant_id
     for update;

  if not found then
    raise exception 'tenant_not_found: %', p_tenant_id;
  end if;

  -- 2. Check sufficient balance
  if v_tenant.credit_balance < p_credit_cost then
    raise exception 'insufficient_credits: balance=% cost=%',
      v_tenant.credit_balance, p_credit_cost;
  end if;

  -- 3. Compute new balance
  v_new_bal := v_tenant.credit_balance - p_credit_cost;

  -- 4. Update tenant credit balance
  update public.tenants
     set credit_balance = v_new_bal
   where id = p_tenant_id;

  -- 5. Insert new event
  insert into public.events
    (tenant_id, name, event_date, tier, storage_limit_gb, link_active_days,
     data_retention_days, credits_used, activated_at)
  values
    (p_tenant_id, p_name, p_event_date, p_tier, p_storage_limit_gb, p_link_active_days,
     p_data_retention_days, p_credit_cost, now())
  returning id into v_event_id;

  -- 6. Append ledger entry
  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note)
  values
    (p_tenant_id, -p_credit_cost, v_new_bal, 'activate_event', v_event_id,
     format('Event: %s (tier: %s)', p_name, p_tier));

  return v_event_id;
end;
$$;

comment on function public.create_event_deduct_credit(uuid, text, date, text, integer, integer, integer, integer) is
  'Atomically creates an event and deducts credits from the tenant balance. '
  'Locks tenant row to prevent concurrent double-spend. '
  'Must be called from service-role only (execute revoked from public/anon/authenticated).';

-- Revoke execute from all default roles; only service_role (SECURITY DEFINER owner) may call
revoke execute on function public.create_event_deduct_credit(uuid, text, date, text, integer, integer, integer, integer) from public;
revoke execute on function public.create_event_deduct_credit(uuid, text, date, text, integer, integer, integer, integer) from anon;
revoke execute on function public.create_event_deduct_credit(uuid, text, date, text, integer, integer, integer, integer) from authenticated;


-- =============================================================================
-- 2. delete_event_with_refund(p_event_id uuid, p_tenant_id uuid)
--    Called when a tenant deletes an event.
--    Soft-deletes the event. Refunds credits only if sync has not yet started.
--    Returns JSONB: { "refunded": boolean, "credits": integer }
-- =============================================================================

create or replace function public.delete_event_with_refund(
  p_event_id  uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event   events%rowtype;
  v_tenant  tenants%rowtype;
  v_refund  integer;
  v_new_bal integer;
begin
  -- 1. Lock event row; verify it exists, belongs to tenant, and is not already deleted
  select *
    into v_event
    from public.events
   where id = p_event_id
     and tenant_id = p_tenant_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'event_not_found: %', p_event_id;
  end if;

  -- 2. Soft-delete the event and clear rekognition collection reference
  update public.events
     set deleted_at                = now(),
         rekognition_collection_id = null
   where id = p_event_id;

  -- 3. Check refund eligibility: sync not started and credits were deducted
  if v_event.sync_started_at is null and v_event.credits_used > 0 then
    v_refund := v_event.credits_used;

    -- 4. Lock tenant row for balance update
    select *
      into v_tenant
      from public.tenants
     where id = p_tenant_id
       for update;

    v_new_bal := v_tenant.credit_balance + v_refund;

    -- 5. Refund tenant credit balance
    update public.tenants
       set credit_balance = v_new_bal
     where id = p_tenant_id;

    -- 6. Append refund ledger entry
    insert into public.credit_ledger
      (tenant_id, delta, balance_after, reason, ref_id, note)
    values
      (p_tenant_id, v_refund, v_new_bal, 'refund', p_event_id,
       format('Event deleted before sync: %s', v_event.name));

    return jsonb_build_object('refunded', true, 'credits', v_refund);
  end if;

  -- 7. No refund (sync already started or no credits used)
  return jsonb_build_object('refunded', false, 'credits', 0);
end;
$$;

comment on function public.delete_event_with_refund(uuid, uuid) is
  'Soft-deletes an event and refunds credits to the tenant if sync has not yet started. '
  'Locks both event and tenant rows to prevent race conditions. '
  'Must be called from service-role only (execute revoked from public/anon/authenticated).';

-- Revoke execute from all default roles; only service_role (SECURITY DEFINER owner) may call
revoke execute on function public.delete_event_with_refund(uuid, uuid) from public;
revoke execute on function public.delete_event_with_refund(uuid, uuid) from anon;
revoke execute on function public.delete_event_with_refund(uuid, uuid) from authenticated;

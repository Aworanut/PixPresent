-- supabase/migrations/20260528050000_welcome_bonus_trigger.sql
-- =============================================================================
-- Update handle_new_user() to grant 199 welcome bonus credits (#12)
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_welcome    integer := 199;
begin
  -- 1. สร้าง tenant row
  insert into public.tenants (owner_user_id, name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  returning id into v_tenant_id;

  -- 2. อัปเดต credit_balance
  update public.tenants
  set credit_balance = v_welcome
  where id = v_tenant_id;

  -- 3. บันทึก credit_ledger สำหรับ welcome bonus
  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, note)
  values
    (v_tenant_id, v_welcome, v_welcome, 'welcome_bonus', 'Welcome bonus on signup');

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-creates public.tenants row and grants 199 welcome bonus credits on signup.';

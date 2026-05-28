# Plan: #14 Credit Balance UI + Event Activation

**Date:** 2026-05-28  
**Issue:** #14 Credit Balance UI + Event Activation  
**Branch:** main  

## Context

#13 (Slip Upload + Credit Ledger) is complete. Now we wire up the credit system to:
1. **Charge at event creation** — atomic deduction via Postgres RPC
2. **Auto-refund on delete** — only if no sync/import has started
3. **Top-up page UI** — package selection + QR/bank info + slip upload
4. **Credit history page** — ledger entries + slip status

**Already done:**
- `credit_balance` pill in dashboard header ✅
- `TIER_CONFIG` in `lib/credit-packages.ts` ✅
- `approve_topup_credit` + `reject_topup` RPCs ✅
- `POST /api/topup/upload-slip` ✅
- `GET /api/account/credits` ✅
- `lib/email/notifications.ts` ✅
- `lib/payment-config.ts` (BANK_INFO, TOPUP_PACKAGES, QR path) ✅
- `public/images/payment-qr.jpeg` ✅

**Key decisions (from ISSUES.md #14):**
- หักเครดิตตอนสร้าง event (ไม่มี "Activate" แยก)
- ถ้า credit ไม่พอ → block create + show error + link to top-up
- Delete before first sync (sync_started_at IS NULL) → auto-refund full amount
- Delete after sync started → no refund (warn user in confirm dialog)
- `events.credits_used` stores how many credits were deducted at creation
- `events.activated_at` = event creation timestamp (set when charged)

---

## Task 1: DB Migration — Event Credit RPCs

**File:** `supabase/migrations/20260528070000_event_credit_rpc.sql`

### 1a. `create_event_deduct_credit` RPC

```sql
create or replace function public.create_event_deduct_credit(
  p_tenant_id          uuid,
  p_name               text,
  p_event_date         date,      -- nullable
  p_tier               text,
  p_storage_limit_gb   integer,
  p_link_active_days   integer,
  p_data_retention_days integer,
  p_credit_cost        integer
)
returns uuid   -- returns new event id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant     tenants%rowtype;
  v_new_bal    integer;
  v_event_id   uuid;
begin
  -- Lock tenant row and read balance
  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'tenant_not_found: %', p_tenant_id;
  end if;

  -- Check sufficient balance
  if v_tenant.credit_balance < p_credit_cost then
    raise exception 'insufficient_credits: balance=% cost=%',
      v_tenant.credit_balance, p_credit_cost;
  end if;

  -- Deduct balance
  v_new_bal := v_tenant.credit_balance - p_credit_cost;
  update public.tenants set credit_balance = v_new_bal where id = p_tenant_id;

  -- Insert event
  insert into public.events (
    tenant_id, name, event_date, tier,
    storage_limit_gb, link_active_days, data_retention_days,
    credits_used, activated_at
  )
  values (
    p_tenant_id, p_name, p_event_date, p_tier,
    p_storage_limit_gb, p_link_active_days, p_data_retention_days,
    p_credit_cost, now()
  )
  returning id into v_event_id;

  -- Insert ledger entry
  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note)
  values
    (p_tenant_id, -p_credit_cost, v_new_bal, 'activate_event', v_event_id,
     format('Event: %s (tier: %s)', p_name, p_tier));

  return v_event_id;
end;
$$;

revoke execute on function public.create_event_deduct_credit(uuid, text, date, text, integer, integer, integer, integer)
  from public, anon, authenticated;
```

### 1b. `delete_event_with_refund` RPC

```sql
create or replace function public.delete_event_with_refund(
  p_event_id  uuid,
  p_tenant_id uuid
)
returns jsonb   -- { refunded: boolean, credits: integer }
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
  -- Lock event row
  select * into v_event from public.events
  where id = p_event_id and tenant_id = p_tenant_id and deleted_at is null
  for update;

  if not found then
    raise exception 'event_not_found: %', p_event_id;
  end if;

  -- Soft-delete event
  update public.events
    set deleted_at = now(), rekognition_collection_id = null
  where id = p_event_id;

  -- Check refund eligibility: only if sync has never started
  if v_event.sync_started_at is null and v_event.credits_used > 0 then
    v_refund := v_event.credits_used;

    -- Lock tenant and refund
    select * into v_tenant from public.tenants where id = p_tenant_id for update;
    v_new_bal := v_tenant.credit_balance + v_refund;
    update public.tenants set credit_balance = v_new_bal where id = p_tenant_id;

    -- Ledger entry
    insert into public.credit_ledger
      (tenant_id, delta, balance_after, reason, ref_id, note)
    values
      (p_tenant_id, v_refund, v_new_bal, 'refund', p_event_id,
       format('Event deleted before sync: %s', v_event.name));

    return jsonb_build_object('refunded', true, 'credits', v_refund);
  end if;

  return jsonb_build_object('refunded', false, 'credits', 0);
end;
$$;

revoke execute on function public.delete_event_with_refund(uuid, uuid)
  from public, anon, authenticated;
```

**Acceptance check:**
- `supabase db reset` passes
- Both RPCs exist in schema

---

## Task 2: Update Server Actions (createEvent + softDeleteEvent)

**Files to modify:**
- `lib/actions/events.ts`

### 2a. Update `createEvent`

Replace the direct INSERT with `create_event_deduct_credit` RPC.

**New flow:**
1. Parse form + validate (existing)
2. Get tenant id (existing — but also get credit_balance)
3. Check `credit_balance >= tierCfg.creditCost` — if not, return error with link to top-up
4. Call `supabase.rpc('create_event_deduct_credit', { ... })` via service role
5. If RPC throws `insufficient_credits` → return error
6. Insert folders (existing, using returned event id)
7. `revalidatePath('/dashboard')` + `redirect('/dashboard')`

**Error message for insufficient credits:**
```typescript
return { error: `เครดิตไม่พอ — ต้องการ ${tierCfg.creditCost} cr แต่มี ${creditBalance} cr กรุณา[เติมเครดิต](/dashboard/account/topup)ก่อนสร้าง event` }
```

Note: The error will be plain text. The form can render the link separately.

### 2b. Update `softDeleteEvent`

Replace direct UPDATE with `delete_event_with_refund` RPC.

**New flow:**
1. Get event (existing: to check rekognition_collection_id) — but also check `sync_started_at`
2. Get tenant_id from event
3. Call `delete_event_with_refund` RPC via service role
4. If refunded, optionally revalidate balance display
5. Delete Rekognition collection (existing)
6. `revalidatePath('/dashboard')` + `redirect('/dashboard')`

Also update `_delete-button.tsx` to show different confirm message based on whether sync has started:
- Before sync: "ลบ event นี้? จะได้รับคืน {credits} cr"
- After sync: "ลบ event นี้? ไม่สามารถคืนเครดิตได้เนื่องจากมีการ import รูปแล้ว"

Pass `hasStartedSync: boolean` and `creditsUsed: number` as props to `DeleteEventButton`.

**Acceptance check:**
- Creating event with sufficient credits deducts balance
- Creating with insufficient credits returns descriptive error
- Deleting event before sync refunds credits
- Deleting event after sync does NOT refund

---

## Task 3: Top-up Page UI

**File:** `app/dashboard/account/topup/page.tsx`

A server component page with embedded client components.

### Layout

```
/dashboard/account/topup
├── Page title: "เติม Credit"
├── Current balance pill (from getCurrentTenant)
├── PackageSelector (client component)
│   ├── 3 package cards: pack_199 / pack_499 / pack_999
│   ├── "Custom" tab: number input (199–99999)
│   └── On select → shows PaymentPanel below
└── PaymentPanel (shown after package selected)
    ├── Amount: {selected} THB (with copy button)
    ├── QR image: /images/payment-qr.jpeg
    ├── Bank info: KBank, นาย วรณัฐ อัครปรีดี, 070-8-10350-0
    ├── PromptPay: 0049990044528064
    └── SlipUploadForm (client component)
        ├── File input (image/*, max 5MB)
        ├── Submit button → POST /api/topup/upload-slip
        ├── Loading state while submitting
        └── Result: success (approved/pending) or error
```

**Component breakdown:**
- `_package-selector.tsx` (client): handles package/custom selection, shows selected state
- `_payment-panel.tsx` (client): shows QR + bank info + copy buttons + slip upload form
- `page.tsx` (server): wraps both, passes current balance

**Important UX:**
- Copy button for amount (uses navigator.clipboard)
- After submit approved: show "✅ เติม {credits} Credits สำเร็จ! ยอดคงเหลือ: {newBalance} cr" + link back to dashboard
- After submit pending: show "⏳ อยู่ระหว่างการตรวจสอบ — ทีมงานจะยืนยันภายใน 24 ชั่วโมง"
- After error: show error message

Use existing UI patterns (Tailwind, zinc color scheme matching rest of dashboard).
No new UI library needed — use existing Button, className patterns.

**Acceptance check:**
- Page loads at `/dashboard/account/topup`
- Package selection updates shown amount
- Custom amount input validates 199–99999 range
- File input accepts images only
- Submit posts to `/api/topup/upload-slip` and shows result

---

## Task 4: Credit History Page

**File:** `app/dashboard/account/credits/page.tsx`

Server component that fetches from `GET /api/account/credits`.

### Layout

```
/dashboard/account/credits
├── Page title: "Credit History"
├── Current balance: {balance} cr (large display)
├── "เติมเครดิต" button → links to /dashboard/account/topup
├── Section: "Slip Uploads" (if any)
│   └── Table: date, package, amount, credits, status badge
└── Section: "Ledger"
    └── Table: date, reason (Thai label), delta (+/-), balance_after
```

**Reason label mapping:**
- `topup_slip` → "เติมเครดิต"
- `activate_event` → "สร้าง Event"
- `refund` → "คืนเครดิต"
- `adjustment` → "ปรับยอด"
- `welcome_bonus` → "Welcome Bonus"

**Status badge colors:**
- `pending` → amber/yellow
- `approved` → green
- `rejected` → red

**Data fetching:**
Fetch from `/api/account/credits` route using `fetch` with `{ cache: 'no-store' }`, OR directly query Supabase (since it's a server component, direct query is simpler and avoids a round-trip).

Use direct Supabase query:
```typescript
const supabase = await createClient()
// get tenant, then ledger + slips (same queries as in the API route)
```

**Acceptance check:**
- Page loads at `/dashboard/account/credits`
- Shows welcome bonus entry for new accounts
- Shows correct delta sign (+/-) for each entry
- Slip status badges show correct color

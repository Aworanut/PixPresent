# Plan: #13 Slip Upload + Credit Ledger

**Date:** 2026-05-28  
**Issue:** #13 Slip Upload + Credit Ledger  
**Branch:** main  

## Context

Phase 1 payment system — manual PromptPay/bank transfer + auto-verify via SlipOK API.
Replaces Omise (deferred to Phase 2 #B-04).

**Already done:**
- `lib/payment-config.ts` — BANK_INFO, TOPUP_PACKAGES, getSlipOkUrl() ✅
- `slip_uploads` table exists (wrong package_id constraint — must fix)
- `credit_ledger` table exists, RLS append-only ✅
- `public/images/payment-qr.jpeg` exists ✅
- `qrcode.react` installed ✅

**Key decisions:**
- SlipOK auto-verifies slip → auto-approve + credit immediately (no admin manual step)
- Fallback: SlipOK unavailable → status=pending + email admin (woranut.ak@gmail.com)
- Email library: Resend (needs npm install + RESEND_API_KEY env)
- Slip R2 path: `/slips/{tenant_id}/{slip_id}.jpg`
- Package IDs: `pack_199 | pack_499 | pack_999 | custom` (from payment-config.ts)

---

## Task 1: DB Migration — Fix package_id constraint + Atomic RPCs

**Files to create:**
- `supabase/migrations/20260528060000_slip_topup_rpc.sql`

**What to do:**

### 1a. Fix slip_uploads.package_id constraint
The existing constraint uses wrong values (`starter|standard|pro|custom`).
Replace with actual package IDs from payment-config.ts:

```sql
alter table public.slip_uploads
  drop constraint slip_uploads_package_id_check,
  add constraint slip_uploads_package_id_check
    check (package_id in ('pack_199', 'pack_499', 'pack_999', 'custom'));
```

### 1b. Create approve_topup_credit RPC

Atomic function called by the API route after SlipOK verification passes.
Uses SECURITY DEFINER so it can bypass RLS (service role writes).

```sql
create or replace function public.approve_topup_credit(
  p_slip_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip      slip_uploads%rowtype;
  v_balance   integer;
begin
  -- Lock the slip row
  select * into v_slip
  from public.slip_uploads
  where id = p_slip_id
  for update;

  if not found then
    raise exception 'Slip not found: %', p_slip_id;
  end if;

  if v_slip.status <> 'pending' then
    raise exception 'Slip % is already %', p_slip_id, v_slip.status;
  end if;

  -- 1. Approve slip
  update public.slip_uploads
  set status = 'approved', verified_at = now()
  where id = p_slip_id;

  -- 2. Compute new balance
  select credit_balance into v_balance
  from public.tenants
  where id = v_slip.tenant_id
  for update;

  v_balance := v_balance + v_slip.credits_claimed;

  -- 3. Update tenant balance
  update public.tenants
  set credit_balance = v_balance
  where id = v_slip.tenant_id;

  -- 4. Insert ledger entry
  insert into public.credit_ledger (tenant_id, delta, balance_after, reason, ref_id, note)
  values (
    v_slip.tenant_id,
    v_slip.credits_claimed,
    v_balance,
    'topup_slip',
    p_slip_id,
    'Auto-approved via SlipOK'
  );
end;
$$;

-- Only service role + super admin can call this
revoke execute on function public.approve_topup_credit(uuid) from public, anon, authenticated;
```

### 1c. Create reject_topup RPC

```sql
create or replace function public.reject_topup(
  p_slip_id   uuid,
  p_reason    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip slip_uploads%rowtype;
begin
  select * into v_slip
  from public.slip_uploads
  where id = p_slip_id
  for update;

  if not found then raise exception 'Slip not found'; end if;
  if v_slip.status <> 'pending' then
    raise exception 'Slip is already %', v_slip.status;
  end if;

  update public.slip_uploads
  set status = 'rejected',
      reject_reason = p_reason,
      verified_at = now()
  where id = p_slip_id;
end;
$$;

revoke execute on function public.reject_topup(uuid, text) from public, anon, authenticated;
```

**Acceptance check:**
- `supabase db reset` runs without errors
- `select * from slip_uploads where package_id = 'pack_199'` works
- `select public.approve_topup_credit` exists in schema

---

## Task 2: Email Notifications (Resend)

**Files to create/modify:**
- `lib/email/notifications.ts` (new)
- `.env.example` (add RESEND_API_KEY)

**What to do:**

### 2a. Install Resend
```bash
npm install resend
```

### 2b. Add to .env.example
```
# Resend (transactional email)
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=noreply@pixpresent.app
```

### 2c. Create lib/email/notifications.ts

Three functions:

**sendAdminSlipPending(params)** — called when SlipOK fails/unavailable
- To: ADMIN_EMAIL (woranut.ak@gmail.com from payment-config.ts)
- Subject: "🔔 Slip รอ verify — {tenantName} {amount}฿"
- Body: tenant name, amount, credits, slip ID, dashboard link

**sendOrganizerTopupApproved(params)** — called after auto-approve succeeds
- To: organizer email
- Subject: "✅ เติม Credit สำเร็จ — {credits} Credits"
- Body: credits added, new balance, account link

**sendOrganizerTopupRejected(params)** — for manual admin reject (used by #19)
- To: organizer email
- Subject: "❌ Slip ไม่ผ่านการตรวจสอบ"
- Body: reason, contact info, retry link

All functions should:
- Return `{ error?: string }` (never throw — email failure must not crash payment flow)
- Log errors to console if Resend is unavailable
- Skip gracefully if RESEND_API_KEY is not set (dev mode)

**Acceptance check:**
- Functions compile without errors
- When RESEND_API_KEY not set → returns `{}` without throwing

---

## Task 3: Slip Upload API Route

**Files to create:**
- `app/api/topup/upload-slip/route.ts`
- `lib/topup.ts` (business logic — separated for testability)

**What to do:**

### 3a. Create lib/topup.ts

Export pure functions (no Next.js imports — makes them unit-testable):

```typescript
// verifySlipWithSlipOK(slipImageBuffer: Buffer, amountThb: number): Promise<SlipOKResult>
// uploadSlipToR2(tenantId: string, slipId: string, buffer: Buffer): Promise<string>
// validateTopupRequest(packageId: string, amountThb: number, credits: number): { valid: boolean; error?: string }
```

`verifySlipWithSlipOK`:
- POST to `getSlipOkUrl()` as multipart with `files` field (slip image)
- Check response `{ success: boolean, data: { ... } }`
- Return `{ verified: boolean; transactionId?: string; error?: string }`
- Catch all errors → return `{ verified: false, error: message }` (never throw)

`validateTopupRequest`:
- Check package_id is valid (pack_199/pack_499/pack_999/custom)
- Check amount_thb matches expected for preset packages
- For custom: check min/max from CUSTOM_TOPUP

### 3b. Create app/api/topup/upload-slip/route.ts

```
POST /api/topup/upload-slip
Content-Type: multipart/form-data

Fields:
  slip_image: File (required)
  package_id: string (required)
  amount_thb: string/number (required)
  credits_claimed: string/number (required)
```

Flow:
1. Auth check — get current tenant via createClient + getUser
2. Parse multipart (use `request.formData()`)
3. Validate inputs via `validateTopupRequest`
4. Generate slip_id = UUID
5. Upload slip image to R2 via `uploadToR2` (from existing lib/storage/r2.ts or similar path in codebase — check which file exports R2 upload)
6. Insert `slip_uploads` row (service role client, status='pending')
7. Call `verifySlipWithSlipOK` 
8. If verified:
   - Call `supabase.rpc('approve_topup_credit', { p_slip_id })`
   - Call `sendOrganizerTopupApproved`
   - Return `{ status: 'approved', credits: ..., newBalance: ... }`
9. If not verified:
   - Call `sendAdminSlipPending`
   - Return `{ status: 'pending' }`

Return types:
```typescript
{ status: 'approved' | 'pending'; credits?: number; newBalance?: number; error?: string }
```

Error handling:
- R2 upload failure → 500
- Supabase insert failure → 500
- SlipOK failure → continue (fallback to pending, not an error response)

**Note on R2 upload path:** Check existing `lib/` for how R2 upload is done in sync pipeline.
Use same pattern. R2 key = `slips/${tenantId}/${slipId}.jpg`.

**Acceptance check:**
- `curl -X POST /api/topup/upload-slip -F "slip_image=@test.jpg" -F "package_id=pack_199" -F "amount_thb=199" -F "credits_claimed=199"` returns 200 JSON
- If SLIPOK_API_URL not set → returns `{ status: 'pending' }` (not 500)

---

## Task 4: Credit Balance + History API

**Files to create:**
- `app/api/account/credits/route.ts`

**What to do:**

```
GET /api/account/credits
```

Response:
```typescript
{
  balance: number;           // current credit_balance
  ledger: Array<{
    id: string;
    delta: number;
    balance_after: number;
    reason: string;
    ref_id: string | null;
    note: string | null;
    created_at: string;
  }>;                        // most recent 50 entries, newest first
  slips: Array<{
    id: string;
    package_id: string;
    amount_thb: number;
    credits_claimed: number;
    slip_image_url: string;
    status: 'pending' | 'approved' | 'rejected';
    reject_reason: string | null;
    uploaded_at: string;
    verified_at: string | null;
  }>;                        // most recent 20 slips
}
```

Auth: required — return 401 if not authenticated.
Use `createClient()` (not service role) — RLS will scope to tenant.

**Acceptance check:**
- Returns 401 for unauthenticated request
- Returns correct balance + empty arrays for new tenant

---

## Task 5: Vitest Setup + Unit Tests

**Files to create/modify:**
- `vitest.config.ts`
- `__tests__/topup.test.ts`

**What to do:**

### 5a. Install Vitest
```bash
npm install -D vitest @vitest/coverage-v8
```

### 5b. vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

### 5c. Add test script to package.json
```json
"test": "vitest run",
"test:watch": "vitest"
```

### 5d. __tests__/topup.test.ts

Test `validateTopupRequest` from `lib/topup.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateTopupRequest } from '@/lib/topup';

describe('validateTopupRequest', () => {
  it('accepts valid pack_199', () => {
    const result = validateTopupRequest('pack_199', 199, 199);
    expect(result.valid).toBe(true);
  });

  it('rejects unknown package_id', () => {
    const result = validateTopupRequest('starter', 199, 199);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects pack_199 with wrong amount', () => {
    const result = validateTopupRequest('pack_199', 100, 100);
    expect(result.valid).toBe(false);
  });

  it('accepts custom within min/max range', () => {
    const result = validateTopupRequest('custom', 500, 500);
    expect(result.valid).toBe(true);
  });

  it('rejects custom below minimum', () => {
    const result = validateTopupRequest('custom', 50, 50);
    expect(result.valid).toBe(false);
  });

  it('rejects custom above maximum', () => {
    const result = validateTopupRequest('custom', 100_000, 100_000);
    expect(result.valid).toBe(false);
  });
});
```

Test `verifySlipWithSlipOK` (mock fetch):

```typescript
describe('verifySlipWithSlipOK', () => {
  it('returns verified=false when SLIPOK_API_URL not set', async () => {
    // Delete env var then call — should return { verified: false }
  });

  it('returns verified=false when SlipOK returns non-OK status', async () => {
    // Mock fetch to return 500 — should catch and return { verified: false }
  });

  it('returns verified=true when SlipOK returns success', async () => {
    // Mock fetch to return { success: true } — should return { verified: true }
  });
});
```

**Acceptance check:**
- `npm test` runs without setup errors
- All validateTopupRequest tests pass

---

## Summary

| Task | Files | Notes |
|------|-------|-------|
| 1. DB Migration | 1 migration file | Fix constraint + 2 RPCs |
| 2. Email Notifications | lib/email/notifications.ts | Install resend |
| 3. Slip Upload API | app/api/topup/upload-slip/route.ts + lib/topup.ts | Core flow |
| 4. Credit API | app/api/account/credits/route.ts | Read-only |
| 5. Tests | vitest.config.ts + __tests__/topup.test.ts | Install vitest |

**Dependencies order:** 1 → 2 → 3 → 4 → 5 (Task 3 needs Task 2; rest are independent)

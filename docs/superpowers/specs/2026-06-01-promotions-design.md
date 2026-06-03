# Promotions — design

**Date:** 2026-06-01 · **Status:** management layer accepted; redemption layer flagged
**Subsystem:** B of the admin-management suite · **Branch:** `feature/admin-management`

## Problem
Give the admin a way to run bonus-credit promotions on top-ups (e.g. "เติม ≥999 รับ
โบนัส 20%"). Payment is slip-based, so a promo grants **bonus credits**, not a price
discount.

## Built now — management layer (safe, greenfield, money-path-free)
- Tables `promotions` + `promo_redemptions` (migration 20260601010000). Admin-only
  via service-role; RLS on with no policies.
- `lib/promotions.ts` — pure logic: `normalizePromoCode`, `computeBonusCredits`
  (percent/fixed), `checkPromoEligibility` (active, window, min top-up, global +
  per-tenant limits). Unit-tested (`__tests__/promotions.test.ts`).
- `/admin/promotions` — create / list / toggle-active / delete promos (service-role
  actions, super-admin gated). New sidebar item.

The admin can fully author and manage promotions. Nothing touches the credit/money
path yet.

## Flagged for review — redemption layer (NEW money movement)
Granting bonus credits is a **new** credit movement, unlike subsystem A (a
behaviour-preserving refactor). It is intentionally NOT shipped autonomously. To
complete it (small, well-scoped — do together when awake):

1. **Widen the ledger reason CHECK** to include `'promo_bonus'`
   (`credit_ledger.reason` currently allows topup_slip / activate_event / refund /
   adjustment / welcome_bonus). Additive.
2. **`slip_uploads.promo_code text null`** — store the entered code on the slip so
   the bonus applies on BOTH auto-approve and manual admin approval (single source).
3. **`redeem_promo(...)` SECURITY DEFINER RPC** (mirror `approve_topup_credit` /
   `adjust_credit`): lock the promo row, re-check eligibility authoritatively
   (server-side, race-safe), add bonus to `tenants.credit_balance`, insert a
   `credit_ledger` row (`reason='promo_bonus'`, `ref_id=slip_id`), insert
   `promo_redemptions`, increment `promotions.redeemed_count`. EXECUTE revoked from
   public/anon/authenticated (service-role only).
4. **Call it at approval** — from `approve_topup_credit` (covers auto + manual) OR
   right after approval in the slip route. Opt-in: no code → no change to the base
   top-up flow.
5. **Top-up UI** — optional promo-code field in `_package-selector` /
   `_payment-panel`; a `validatePromoCode` server action for live preview (uses
   `checkPromoEligibility`).
6. Verify with a DB round-trip on `redeem_promo` (balance + ledger + redemption +
   counter), then `db:types`.

## Testing (this layer)
- Unit (`__tests__/promotions.test.ts`): bonus calc + eligibility (window, min,
  limits). · Migration applied; tsc + eslint + full suite green.

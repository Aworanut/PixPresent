# DB-driven pricing / tier config — design

**Date:** 2026-06-01 · **Status:** accepted · **Subsystem:** A of the admin-management suite
**Branch:** `feature/admin-management`

## Problem
`TOPUP_PACKAGES` (lib/payment-config.ts) and `TIER_CONFIG` (lib/credit-packages.ts)
are code constants — changing a price or a per-tier feature needs a code edit +
redeploy. The admin should edit pricing + tier features from the UI.

## Approach — DB source of truth, constants as fallback (money-path-safe)
- Two tables: `topup_packages`, `event_tiers`, **seeded from the current constants**.
- `lib/pricing.ts` loaders read the DB and **fall back to the constants** on
  empty/error (external-service-degradation convention). So if the DB is wiped or
  unreachable, behaviour == today. The constants are NOT deleted.
- Reads are server-side via the service-role client, memoized per-request with
  React `cache` (fresh across requests → an admin edit takes effect immediately,
  no stale-cache mismatch between display and validation).
- **Event snapshot preserved:** `create_event_deduct_credit` still copies the tier
  config onto the event row, so price/feature changes affect only NEW events.

## Money-path consistency
Everyone reads the same loader, so display and validation never diverge:
- `validateTopupRequest` (lib/topup.ts) gains an optional `opts.packages` /
  `opts.custom` (dependency injection). Default = constants (existing callers/tests
  unchanged); the slip route injects DB packages. Valid ids are derived from the
  injected set, so an admin-added package validates and a removed one is rejected.
- `createEvent` loads the tier via `loadTierConfig(tier)` before the RPC.
- Topup UI (`page → _topup-flow → _package-selector`) and the event-create tier
  selector receive packages/tiers as props from their server pages.

## Admin UI
`/admin/pricing` — edit each package (credits, price, label, highlight, active) and
each tier (credit cost, storage, link days, retention, label, description, active)
via service-role server actions (super-admin gated by `app/admin/layout.tsx`).
New "Pricing" sidebar item.

## RLS
RLS on; authenticated SELECT (future client reads); no write policy (service-role
only). Append/edit happen via service-role in the admin actions.

## Deferred (flagged)
- `WELCOME_BONUS_CREDITS` stays a code constant (also read by a DB signup trigger —
  moving it is a separate change).
- `CUSTOM_TOPUP` min/max + `BANK_INFO` stay code constants for now.

## Testing
- Unit (`__tests__/pricing.test.ts`): `validateTopupRequest` with injected packages
  / custom range + backward-compat default.
- Migration applied locally; DB round-trip on the two tables; tsc + eslint + full
  suite green.

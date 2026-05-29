# Pixture (FaceFind) — Handoff Document
**Date:** 2026-05-29  
**Project root:** `/Users/nuk/Pixture`  
**Stack:** Next.js 16 App Router · Supabase · AWS Rekognition · Cloudflare R2 · Google Drive API · SlipOK

---

## What This Is

**PixPresent / FaceFind** — Thai event-photo distribution SaaS. Organizers upload photos from Google Drive, the system indexes faces via AWS Rekognition, then guests find their own photos by uploading a selfie (face search). Monetisation: credit-based top-up via bank transfer slip + SlipOK auto-verification.

Full PRD: `/Users/nuk/Pixture/facefind_spec.html`  
Issue tracker: `/Users/nuk/Pixture/ISSUES.md`

---

## Current State (as of this handoff)

### ✅ Working end-to-end (tested locally with real credentials)

| Flow | Status |
|------|--------|
| Organizer signup → tenant provisioning | ✅ |
| Event CRUD + multi-folder Google Drive | ✅ |
| Sync & Index: Drive → resize → R2 upload → Rekognition IndexFaces | ✅ confirmed today |
| Guest link generation (token, expiry, revoke) | ✅ |
| Guest face search: selfie → Rekognition SearchFacesByImage → matched photos | ✅ confirmed today (user reached face search step) |
| Photo gallery + download (ZIP) | ✅ |
| Credit top-up via bank slip + SlipOK auto-verify | ✅ (verified with real slip) |
| Admin slip approval page `/admin/slips` | ✅ |
| Credit balance indicator + history | ✅ |
| Event activation / credit deduction / refund on delete | ✅ |

### ❌ Remaining before Internal Pilot (#18)

| # | Task | Notes |
|---|------|-------|
| #7 | 1,000 photos no timeout | Code is sequential; concurrent processing needed before real-scale test |
| #8 | Verify blacklist blocks guest search E2E | Code ready; needs manual test |
| #10 | Face search latency ≤ 5s for 1,000 photos | Needs real data |
| #11 | Gallery load ≤ 2s | Needs real data |
| #15 | PDPA consent modal | **HITL** — needs legal review of Thai/EN consent copy |
| #16 | Rekognition cleanup policy | **HITL** — product decision required |
| #17 | Supabase Cloud + Vercel production deploy | Blocked by all above |
| #18 | Internal pilot | Blocked by #17 |

---

## Architecture Decisions (do not undo)

- **`create_event_deduct_credit` / `delete_event_with_refund` / `approve_topup_credit` / `reject_topup`** — all SECURITY DEFINER RPCs, EXECUTE revoked from public/anon/authenticated. Must always be called via `createServiceRoleClient()`.
- **Sync route** uses Server-Sent Events (SSE) — `/api/events/[id]/sync` streams progress to `_sync-button.tsx`. No `maxDuration` set yet (needed before production for 1,000-photo batches).
- **SlipOK auth header** is `x-authorization: {TOKEN}` — NO `Bearer` prefix.
- **Admin guard** in `app/admin/layout.tsx` checks `user.email === ADMIN_EMAIL` (from `lib/payment-config.ts`).
- **Tab routing** in account page: Profile/Security use `?tab=` query param; Credits/Top-up are full href routes (`/dashboard/account/credits`, `/dashboard/account/topup`).
- **`rejected: boolean`** flag in `verifySlipWithSlipOK()` distinguishes SlipOK explicit rejection (auto-reject slip) vs network error (keep pending for admin).

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/events/[id]/sync/route.ts` | SSE sync route (sequential, no concurrency yet) |
| `app/api/topup/upload-slip/route.ts` | Slip upload, SlipOK verify, auto-approve/reject |
| `lib/topup.ts` | `validateTopupRequest` + `verifySlipWithSlipOK` |
| `lib/aws/rekognition.ts` | Rekognition client wrapper |
| `lib/google-drive-api.ts` | Drive client, `listImagesInFolder`, `downloadDriveFile` |
| `lib/image-processing.ts` | Resize to web (1920px JPEG 85%) + full |
| `lib/actions/events.ts` | `createEvent` / `softDeleteEvent` calling RPCs |
| `app/dashboard/account/topup/` | Top-up UI (page + `_topup-flow.tsx`, `_package-selector.tsx`, `_payment-panel.tsx`) |
| `app/dashboard/account/credits/page.tsx` | Credit ledger + slip history |
| `app/admin/slips/` | Admin slip approval (page + `_slip-actions.tsx` + `_actions.ts`) |
| `app/admin/layout.tsx` | Admin guard — email check |
| `lib/payment-config.ts` | `TOPUP_PACKAGES`, `CUSTOM_TOPUP`, `ADMIN_EMAIL`, bank info |

---

## Environment Variables (`.env.local`)

**Never commit these.** All required for full functionality:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AWS Rekognition (3 vars user confirmed they have)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Google OAuth (Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000

# SlipOK
SLIPOK_API_URL=https://api.slipok.com/api/line/apikey/XXXXX
SLIPOK_API_TOKEN=

# Resend (email)
RESEND_API_KEY=
```

> **Security note:** `ADMIN_EMAIL` is currently hardcoded as `"woranut.ak@gmail.com"` in `lib/payment-config.ts`. Move to `SUPER_ADMIN_EMAIL` env var before any public repo push.

---

## Known Issues / TODOs

1. **`#13-race` comment** in `upload-slip/route.ts` — `verification.transactionId` not yet stored in `slip_uploads`. Should add unique constraint to prevent double-credit on duplicate slips (SlipOK rejects duplicates itself, but no DB-level guard).
2. **Sync concurrency** — `app/api/events/[id]/sync/route.ts` processes photos sequentially. Needs concurrent Promise pool (5–10 concurrent) + `export const maxDuration = 300` before testing 1,000 photos.
3. **`tenants.phone TEXT null`** column — planned in #3 schema but never migrated.
4. **#19 Admin panel** — basic version exists at `/admin/slips` but full spec (audit log, dashboard, filter history) not complete.

---

## Recent Commits (for context)

```
fb8201c fix: replace 'Indochina Time' with 'Bangkok Time' in SlipOK error messages
fd95bc6 feat: auto-reject slips when SlipOK explicitly rejects them
9ed8ee1 fix: remove Bearer prefix from SlipOK auth header + cleanup debug logs
6279be0 feat: add /admin/slips approval page
9b2e34b feat: add Credits and Top-up tabs to account page (#14)
cac2ece fix: scope attrs + null-safe date in credits page (#14)
e06ca54 feat: add /dashboard/account/credits history page (#14 Task 4)
```

---

## Immediate Next Steps (suggested order)

1. **E2E guest flow test** — open a guest link → upload selfie → view gallery → download ZIP. Confirm no errors.
2. **Blacklist E2E test (#8)** — use Blacklist Manager to block a face → search again → verify photo is filtered out.
3. **Sync concurrency fix (#7)** — add concurrent Promise pool + `maxDuration` to `app/api/events/[id]/sync/route.ts` to support 1,000 photos without timeout.
4. **PDPA consent (#15)** — await legal approval, then add modal + `consent_given_at` column to `guest_sessions`.
5. **Cleanup policy (#16)** — await product decision, then implement Supabase cron job.
6. **Production deploy (#17)** — push migrations to Supabase Cloud + deploy to Vercel.

---

## Suggested Skills

The next agent should invoke these skills as appropriate:

- **`superpowers:subagent-driven-development`** — for any multi-task implementation work (concurrency fix, PDPA modal, etc.)
- **`superpowers:writing-plans`** — before starting a new feature/issue
- **`superpowers:test-driven-development`** — when implementing sync concurrency or any new feature
- **`superpowers:finishing-a-development-branch`** — before merging completed work

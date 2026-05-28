# Pixture / PixPresent — Handoff Document

**Date:** 2026-05-28  
**Project root:** `/Users/nuk/Pixture`  
**GitHub:** https://github.com/Aworanut/PixPresent

---

## What was done this session

### 1. Drive Modal redesign (`_event-toolbar.tsx`)
- **Removed** per-row Connect / Disconnect button and `statuses` state
- **Added** `onBlur` auto-fetch on the folder URL field using `testDriveFolder` server action
  - Shows `⋯` / `✓` / `✗` inline inside the input field
  - Auto-fills label with Drive folder name if label is empty
  - Clears status when URL changes
- **Save** now closes modal immediately (no toast)
- **Renamed** Sync → Import throughout (`SyncModal` title, button labels, status messages)
- **Fixed** `abortRef` bug: was `{ current: null }` plain object (re-created every render) → now `useRef<AbortController | null>(null)` so "หยุด" button actually works

### 2. Account Management page (new)
- Route: `/dashboard/account?tab=profile|security`
- Entry point: click tenant name/email in dashboard header → `/dashboard/account`
- **Profile tab:** edit organization name, display email (read-only)
- **Security tab:** change password form (new password + confirm)
- **Billing / Usage tabs:** visible but disabled + "(coming soon)" — intentional reminder

**New files:**
- `lib/actions/account.ts` — `updateTenantName`, `changePassword`, `disconnectGoogleAccount` (last one unused in UI for now)
- `app/dashboard/account/page.tsx`
- `app/dashboard/account/_profile-section.tsx`
- `app/dashboard/account/_security-section.tsx`

**Modified:**
- `app/dashboard/layout.tsx` — tenant name/email wrapped in `<Link href="/dashboard/account">`

### 3. ISSUES.md checkbox updates
- **#3 DB Schema:** ticked core tables ✓, RLS ✓, TypeScript types ✓ — credit tables still pending
- **#4 Auth:** all items ticked ✓

---

## Key design decisions (grill-me session)

| Decision | Outcome |
|---|---|
| Per-folder "Connect" button | Removed — adding URL = connected by definition |
| "Sync" rename | → **Import** (clearer intent: pull photos in) |
| "Publish" concept | Not needed — share link already gates guest access |
| Auto-sync vs on-demand | On-demand only (already the case) |
| Multi-Gmail workaround | Not Pixture's problem — Drive is just import source; R2 is Pixture's storage |
| Account Management scope | Profile + Security only for now; Billing + Usage depend on #12/#13 |
| Google Drive section in Security | Removed — user didn't ask, Drive is managed in event modal |

---

## Current state of Phase 1 issues

See `/Users/nuk/Pixture/ISSUES.md` for full detail. Summary:

| # | Issue | Status |
|---|---|---|
| #3 | DB Schema | Partial — credit tables missing |
| #4 | Auth | ✅ Done |
| #5 | Event CRUD | ✅ Done |
| #7 | Import & Index (was Sync) | ✅ Done (NFR 1k photos unverified) |
| #8 | Blacklist Manager | ✅ Done (E2E unverified) |
| #9 | Guest Link Generation | ✅ Done |
| #10 | Guest Face Search | ✅ Done (latency unverified) |
| #11 | Photo Gallery + Download | ✅ Done (session persist deferred) |
| #12 | Credit Package Pricing | ❌ HITL — pricing decision needed |
| #13 | Slip Upload + Credit Ledger | ❌ Not started |
| #14 | Credit Balance UI | ❌ Not started (maps to Account > Billing/Usage) |
| #19 | Super Admin Panel | ❌ Not started |

---

## Architecture notes

### Import flow (Google Drive → Pixture)
```
organizer adds folder URLs to event (event_storage_folders table)
→ clicks Import in toolbar modal
→ POST /api/events/[id]/sync (SSE stream)
→ pulls photos from all folders using tenant's google_refresh_token
→ resize + upload to R2
→ index faces in Rekognition
→ save to photos table
```

**Auth:** One Google OAuth token per tenant (`tenants.google_refresh_token`). Photographers must share folders to this account. Multi-Gmail workaround is acceptable (not Pixture's concern).

### Key tables
- `tenants` — `id, name, owner_user_id, google_refresh_token, credit_balance, plan`
- `events` — `id, tenant_id, name, event_date, is_indexed, share_token, share_token_expires_at, ...`
- `event_storage_folders` — `id, event_id, label, folder_id`
- `photos` — `id, event_id, r2_web_url, is_hidden, face_details, storage_file_id, rekognition_face_ids`
- `face_blacklist` — `id, event_id, face_id`

### Important files
- `app/dashboard/events/[id]/_event-toolbar.tsx` — Drive modal + Import modal + Share modal
- `app/dashboard/events/[id]/_photo-gallery.tsx` — gallery with tabs (ทั้งหมด | ถูกแบน), grid/list, action menu
- `app/dashboard/events/[id]/page.tsx` — event detail (gallery-first layout)
- `app/e/[token]/_face-search.tsx` — guest face search + lightbox + download
- `app/api/events/[id]/sync/route.ts` — SSE import route
- `lib/actions/account.ts` — account management server actions

---

## What's next (suggested)

**Highest priority AFK work:**
1. **#13 Slip Upload + Credit Ledger** — schema + server actions for manual payment flow
2. **#19 Super Admin Panel** — slip verification UI
3. **#14 Billing UI** — once #12/#13 done, add to Account page Billing/Usage tabs

**HITL blockers:**
- **#12 Credit Package Pricing** — needs pricing decision (packages, amounts, free trial)

---

## Suggested skills

- `/grill-me` — for thinking through credit/billing UX before building #14
- `/scrutinize` — after implementing #13 to check edge cases (double approve, race conditions)
- `/debug-mantra` — if Rekognition face search issues surface during E2E testing

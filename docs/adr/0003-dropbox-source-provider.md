# ADR 0003 — Dropbox as a Second Storage Source (pulled into Phase 1)

**Status:** Accepted
**Date:** 2026-05-30
**Deciders:** Core team (product + engineering)
**Related:** #5 (Event CRUD + Multi-Folder), #7 (Sync & Index), Q1 (storage provider), ISSUES.md Phase 2 → Phase 1; plan `docs/superpowers/plans/2026-05-30-dropbox-source-provider.md`

---

## Context

Phase 1 ingests event photos from **Google Drive only**. Dropbox and "Local upload"
were both parked in Phase 2 (Q1), to be revisited after the pilot (#18), because
Phase 2 work is gated on pilot signal ("Blocked by #18").

A concrete prospective customer is blocked **now**: they are a **web-only Dropbox**
organizer — their photo library lives in Dropbox cloud, not synced to a local disk —
so they cannot onboard through the Drive-only flow. This is a real, pre-pilot
adoption blocker, not a hypothetical.

The photo pipeline is only coupled to Google Drive at one seam: listing files and
downloading bytes (`app/api/events/[id]/sync/route.ts`). Everything downstream
(sharp → R2 → Rekognition → `photos` insert) already operates on raw `Buffer`s and
is source-agnostic. `tenants.storage_provider` (`gdrive`/`dropbox`) existed as an
unused stub; `event_storage_folders` had no source discriminator.

Typical event volume for this customer is **≤500 photos**.

---

## Decision

Pull **Dropbox ingestion** from Phase 2 into Phase 1 and build it as a native
integration, structured around a thin provider abstraction:

1. **Introduce a `StorageProvider` interface** (`listImages` + `downloadFile`) and
   route the sync loop through it. Google Drive is wrapped as one provider (the
   existing `lib/google-drive-api.ts` is reused, not rewritten); Dropbox is a second
   provider built on Dropbox HTTP API v2 via `fetch` (no SDK dependency).
2. **Source is chosen per folder** — add `event_storage_folders.source_type`
   (`gdrive`/`dropbox`), so one event can mix Drive + Dropbox folders. Uniqueness
   moves from `(event_id, folder_id)` to `(event_id, source_type, folder_id)`.
3. **Dropbox OAuth tokens mirror the Google columns** —
   `tenants.dropbox_refresh_token` + `dropbox_connected_at` (offline access /
   long-lived refresh token).
4. **Folder identification is path-based** — organizer pastes a Dropbox folder path,
   validated on blur (mirrors the Drive URL flow).

---

## Alternatives considered

- **Concierge / manual bridge (zero code):** founder downloads from the customer's
  Dropbox, drops into a Google Drive folder, runs the existing sync; keep Dropbox in
  Phase 2. *Cheapest, and the recommended option for a single customer* — explicitly
  surfaced. **Not chosen:** the team opted to build the durable integration now.
- **Local upload as a universal escape hatch:** organizer drags files from disk →
  browser upload. Covers any non-Drive user *if their files are on disk*. **Not
  chosen / not applicable:** this customer is web-only cloud (files not synced
  locally), so Local upload would force a manual download-first step — it does not
  solve the actual blocker. (Local upload remains a separate, still-valid Phase 2
  item for a different need.)
- **Run the pilot on a Drive customer, defer Dropbox:** the pilot validates the core
  product (face-search accuracy, latency, UX), which is orthogonal to storage source.
  **Not chosen:** the team prioritized unblocking this specific customer now.
- **Per-event source (`events.source_type`) instead of per-folder:** simpler UI.
  **Not chosen:** loses the multi-team mixing the multi-folder model exists for, and
  the discriminator's normalized home is the folder row; per-folder costs only one
  column + a per-row picker.
- **Inline `if (source === 'dropbox')` branching in `runSync`:** fastest now. **Not
  chosen:** bloats `runSync` and forces a larger refactor at the third provider; the
  seam is already clean, so wrapping is low-risk and matches the PaymentService
  abstraction philosophy already planned (#B-03/#B-04).

---

## Scope boundaries (explicitly out)

- **No background job / queue.** At ≤500 photos, the single-request SSE sync plus the
  existing per-photo resumability (dedup via `storage_file_id`) suffices.
- **No Dropbox Chooser widget / folder browser** — paste-path + validate-on-blur.
- **No normalized `storage_connections` table** — mirror `tenants.google_*` columns
  (YAGNI until a third provider).
- **No Dropbox production-app approval dependency** — Development status supports up to
  500 linked users; the pilot (one customer) needs no review. Production approval is a
  post-pilot task, required only past 50 linked users.
- **Shared-link Dropbox folders unsupported** in this iteration (path-only).

---

## Consequences

**Positive**
- Unblocks the web-only Dropbox customer before the pilot.
- The provider seam is reusable; a future provider implements two methods.
- Google Drive code path is wrapped, not rewritten — low regression risk.

**Negative / risks**
- New OAuth surface (Dropbox app registration, redirect URIs, secrets) to operate.
- Short-lived Dropbox access tokens require a refresh on each sync/validate (cheap).
- **Serverless timeout risk:** the single-request sync can exceed Vercel's ~300s on a
  cold full sync. Accepted at ≤500 via verify-before-pilot (resume by re-click); a
  ~10-line time-budget+auto-resume guard is the fallback if it fails — **not** a queue.
  The ISSUES.md "#7 — รองรับ 1,000 รูป — verified" claim is suspect on Vercel and must
  be re-verified in prod.
- Before scaling past 50 Dropbox users, the app must obtain Dropbox Production status.

**Follow-ups**
- Local upload (Phase 2) remains open for the on-disk / no-cloud case.
- Per-provider precise sync gating (currently: enable if any provider connected;
  server skips unconnected-provider folders with a warning).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**PixPresent** — a multi-tenant SaaS that distributes event photos by face. A guest opens a public share link, uploads a selfie, and AWS Rekognition matches their face against the event's indexed photos so they can view and download just their own shots. Organizers (each a "tenant") create events, sync source photos from Google Drive, and spend prepaid **credits** to activate events; credits are bought by bank transfer and verified through the SlipOK API.

The root also holds static design/PRD artifacts — `facefind_spec.html` (interactive PRD), `facefind_landing.html`, `facefind_design_lab.html`, `competitor_analysis.html`, `font_comparison.html`. These are reference docs, **not** part of the app build.

> **Naming.** The product is **PixPresent** (the local repo directory is `Pixture`). "FaceFind" is the **former** name — it now survives only in legacy artifact filenames (`facefind_*.html`) and historical references. Do **not** use "FaceFind" in new code, UI copy, comments, commit messages, or docs; write **PixPresent** everywhere.

## Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** (PostCSS, `tw-animate-css`) · **shadcn/ui** (`base-nova` style, `@base-ui/react`, `lucide-react` + `@heroicons/react`)
- **Supabase** — Postgres + Auth + Storage + RLS; local stack via the Supabase CLI + Docker
- **AWS Rekognition** — per-event face collections (index + search)
- **Cloudflare R2** — photo storage (via `@aws-sdk/client-s3` + presigner)
- **Google Drive** (`googleapis`) — source folder for event photos
- **Resend** — transactional email · **SlipOK** — Thai bank-slip verification
- **sharp** (image derivatives/watermark) · **fflate** (zip download) · **qrcode.react** (PromptPay QR)
- **Vitest** (unit tests, node env) · **ESLint 9** (`eslint-config-next`)

> **Next.js 16 is not the version in your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before using unfamiliar APIs. Two gotchas already in play: middleware was renamed to **`proxy.ts`** (the exported function must be named `proxy`), and **`cookies()` is async** — always `await` it (see `lib/supabase/server.ts`).

## Commands

`npm run dev` runs Supabase + Next.js together, so **Docker Desktop must be running first**.

| Command | What it does |
|---|---|
| `npm run dev` | Supabase stack + Next.js (Turbopack) concurrently — app on :3000, API on :54321 |
| `npm run dev:db` / `dev:web` | Just Supabase / just Next.js |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest (run once) · `npm run test:watch` to watch |
| `npm run db:reset` | Drop DB and re-run **all** migrations |
| `npm run db:types` | Regenerate `lib/supabase/types.ts` from the live schema |
| `npm run db:status` / `db:stop` | Show local URLs+keys / stop containers |

Run one test file: `npx vitest run __tests__/topup.test.ts` · filter by name: `npx vitest run -t "validateTopupRequest"`.

Local URLs (during `npm run dev`): app `:3000` · Supabase Studio `:54323` · API `:54321` · Inbucket test mail `:54324` · Postgres `:54322`.

## Architecture

**Multi-tenancy.** One `tenants` row per signup (FK to `auth.users`, created by a DB trigger). `getCurrentTenant()` (`lib/auth/current-tenant.ts`, React-`cache`d) resolves the logged-in user → their tenant `{id, name, plan, credit_balance}`. Almost all app data hangs off `tenant_id`, isolated by RLS; the admin area is gated by `is_super_admin()` which reads a JWT `app_metadata.is_super_admin` flag.

**Three Supabase clients — pick by context:**
- `lib/supabase/server.ts` → Server Components / Route Handlers / Server Actions (anon key, user session via cookies, **RLS-enforced**).
- `lib/supabase/client.ts` → browser client for Client Components.
- `lib/supabase/service-role.ts` → **bypasses RLS**; server-only, for guest-facing flows (face search) and privileged writes. Never reaches the client.
- `lib/supabase/middleware.ts` `updateSession()` refreshes the session and is called from `proxy.ts`.

**Auth & routing.** `proxy.ts` refreshes the session and gates routes: unauthenticated hits to `/dashboard` → `/login`; authenticated users on auth pages → `/dashboard`. Route groups: `app/(auth)/*` (login/signup/forgot/reset), `app/dashboard/*` (organizer app), `app/admin/*` (super-admin), `app/e/[token]/*` (public guest landing), `app/api/*` (route handlers), `app/auth/callback/route.ts` (Supabase OAuth callback). Page-private components are colocated as `_name.tsx`.

**Mutations go through Server Actions.** `lib/actions/*` (`"use server"`): auth, events, photos, share-link, face-search, blacklist, drive, account. Business logic that must stay unit-testable lives **outside** actions with no Next imports (`lib/topup.ts`, `lib/credit-packages.ts`, `lib/payment-config.ts`) so Vitest can exercise it directly.

**Photo pipeline.** Organizer connects a Google Drive folder (`lib/google-drive*.ts`, OAuth via `app/api/auth/google/*`) → **Sync** (`app/api/events/[id]/sync`, `lib/actions/photos.ts`) pulls files, processes them with sharp (`lib/image-processing.ts`) into web + full derivatives, uploads to R2 (`lib/r2.ts`), and indexes faces into a per-event Rekognition collection (`events.rekognition_collection_id`), storing the returned `rekognition_face_ids` (`text[]`, GIN-indexed) on each `photos` row. Idempotent via `unique(event_id, storage_file_id)`.

**Guest face search (core product).** `app/e/[token]` → guest uploads selfie → `searchFaces` (`lib/actions/face-search.ts`, service-role) re-validates the share token + expiry, runs Rekognition `SearchFacesByImage` (threshold 80) against the event collection, filters `face_blacklist`, returns `match_only` photos merged with `public` photos, and logs a `guest_sessions` row (with PDPA `consent_at`). Bulk download via `app/api/download/zip` (fflate).

**Credits & top-up.** Activating an event spends credits (logged as `activate_event` in `credit_ledger`). Tenants buy credits at `app/dashboard/account/topup`: pick a package (`lib/credit-packages.ts` / `payment-config.ts`), pay via PromptPay QR, upload the slip (`app/api/topup/upload-slip`). `verifySlipWithSlipOK` (`lib/topup.ts`) auto-verifies/auto-rejects via the SlipOK API; network errors fall back to `pending`. Admins review pending slips at `app/admin/slips`. `credit_ledger` is an **append-only** audit trail (RLS permits only service-role/RPC writes).

**Data model & migrations.** Core tables: `tenants, events, photos, face_blacklist, guest_sessions, slip_uploads, credit_ledger`. Schema is built up by timestamped files in `supabase/migrations/` — **change schema only by adding a new migration**, then `npm run db:reset` + `npm run db:types`. Never edit an applied migration. The earliest migration is historical (e.g. the `photographers` table was later pivoted to `event_storage_folders`; `share_token`, photo `visibility`, etc. were added later) — **treat `lib/supabase/types.ts` and the latest migrations as the source of truth**, not the initial schema.

**External-service degradation.** Rekognition, R2, Google, SlipOK, etc. all **stub gracefully when their env vars are absent**, so the app runs locally without real credentials. See `.env.example` and `docs/external-services-setup.md`.

## Conventions

- **Bilingual copy:** English for structural labels, headings, and technical terms (schema types, stack/feature names); Thai for user-facing body text and messages. Match this in UI copy and docs.
- **Phase-2 / commerce prep:** monetized features are pre-staged as *nullable* schema columns defaulting `NULL`/`FALSE` (e.g. `price`, `watermark_url`, `commerce_enabled`, `highlight_reel_*`) and gated behind paid tiers, rather than branched later.
- `AGENTS.md` is the Codex-facing twin of this file — keep them in sync when project facts change.

## Docs & issue tracking

- `README.md` — setup, prerequisites, troubleshooting · `ISSUES.md` — vertical-slice issues + MVP critical path
- `docs/external-services-setup.md` — wiring AWS/R2/Google/SlipOK/Resend · `docs/superpowers/{plans,specs}/` — feature plans & specs
- `facefind_spec.html` — the original interactive PRD

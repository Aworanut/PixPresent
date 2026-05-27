# PixPresent · FaceFind

Event photos, found by face — บริการแจกรูปงาน event ที่ใช้ face recognition ค้นหารูปจาก selfie ของแขก

> 📄 PRD: [`facefind_spec.html`](./facefind_spec.html) · 📋 Issues: [`ISSUES.md`](./ISSUES.md) · 🔌 External setup: [`docs/external-services-setup.md`](./docs/external-services-setup.md) · 🤖 AI agents: [`AGENTS.md`](./AGENTS.md) · [`CLAUDE.md`](./CLAUDE.md)

---

## Prerequisites

- **Node.js** ≥ 22 ([nvm](https://github.com/nvm-sh/nvm) แนะนำ)
- **Docker Desktop** — รัน Supabase local stack (Postgres, Studio, Auth, Storage)
- **Supabase CLI** ≥ 2.x — `brew install supabase/tap/supabase`
- **npm** ≥ 10 (มาพร้อม Node 22)

```bash
node --version    # v22.x
docker --version  # 29.x
supabase --version # 2.x
```

---

## Setup (one-time)

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. คัดลอก env template (`.env.local` มี Supabase local keys ครบแล้ว)
cp .env.example .env.local

# 3. Start Docker Desktop ก่อนแล้วค่อย start dev
npm run dev
```

ครั้งแรก `supabase start` จะ pull Docker images ใช้เวลา ~5–10 นาที (ครั้งถัดไปเร็วมาก)

เปิด <http://localhost:3000> ตรวจดูว่า "Supabase (local)" แสดง **OK** สีเขียว ✅

---

## Daily commands

| Command | สิ่งที่ทำ |
|---|---|
| `npm run dev` | Supabase + Next.js dev server พร้อมกัน (port 3000 + 54321) |
| `npm run dev:db` | เฉพาะ Supabase stack |
| `npm run dev:web` | เฉพาะ Next.js (Turbopack) |
| `npm run db:status` | แสดง URL + keys ปัจจุบันของ local Supabase |
| `npm run db:reset` | ล้างฐานข้อมูล + รัน migration ใหม่ทั้งหมด |
| `npm run db:types` | Generate TypeScript types จาก schema → `lib/supabase/types.ts` |
| `npm run db:stop` | หยุด Supabase containers |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

---

## Local URLs (เมื่อ `npm run dev` รัน)

| Service | URL |
|---|---|
| Next.js app | <http://localhost:3000> |
| Supabase Studio | <http://127.0.0.1:54323> |
| Supabase API | <http://127.0.0.1:54321> |
| Inbucket (test emails) | <http://127.0.0.1:54324> |
| Postgres | `postgres://postgres:postgres@127.0.0.1:54322/postgres` |

---

## Project structure

```
.
├── app/                    # Next.js App Router (pages, layouts, API routes)
├── components/ui/          # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser client (Client Components)
│   │   ├── server.ts       # Server client (Server Components, Route Handlers)
│   │   └── middleware.ts   # Session refresh helper
│   └── utils.ts            # cn() + shared helpers
├── proxy.ts                # Next.js 16 Proxy (was middleware.ts in v15)
├── supabase/
│   ├── config.toml         # Local stack config
│   └── migrations/         # SQL migrations (added in Issue #3)
├── facefind_spec.html      # PRD (interactive)
└── ISSUES.md               # Tracer-bullet vertical slices
```

---

## Issue tracking

ทำงานทีละ issue ตามลำดับใน [`ISSUES.md`](./ISSUES.md). Critical path สำหรับ MVP:

> #1 → #3 → #4 → #5 → #7 → #8 → #9 → #10 → #11 → #13 → #14 → #19 → #17 → #18

ตอนนี้: **#1** ✅ · **#3** ✅ · **#4** ✅ · **#5** ✅ · **#9** ✅ · **#10** ✅ · **#7 Sync & Index** ✅ (code ready, rอ #2 credentials) — รอ **#2 External Services** (HITL) เพื่อทดสอบ #7 จริง

> **Schema pivot:** ตัด `photographers` table ทิ้ง → ใช้ `event_storage_folders` (label + folder_id) แทน. ดู [ISSUES.md](./ISSUES.md) #5 สำหรับ rationale

---

## Troubleshooting

**Docker not running** — start Docker Desktop ก่อน `npm run dev`

**Port already in use** — `npm run db:stop` แล้ว start ใหม่; หรือ `supabase stop --no-backup` ถ้าค้าง

**Supabase keys mismatch** — `npm run db:status` แล้ว copy `anon key` / `service_role key` ไปใส่ `.env.local`

**Next.js cookies error** — Next.js 16 ทำให้ `cookies()` เป็น async ทั้งหมด ต้อง `await cookies()` เสมอ (ดู `lib/supabase/server.ts`)

**Middleware not running** — Next.js 16 เปลี่ยนชื่อจาก `middleware.ts` เป็น `proxy.ts` แล้ว ฟังก์ชันต้องชื่อ `proxy` (ดู [Next.js 16 Proxy docs](node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md))

---

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + Storage + RLS) · AWS Rekognition · Cloudflare R2 · Google Drive

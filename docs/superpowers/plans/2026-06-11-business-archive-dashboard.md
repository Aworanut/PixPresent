# Business Archive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Business-tier tenants open `/dashboard` into a file explorer — every event shown as a root folder tile, plus a free no-ceremony "สร้างแฟ้ม" — while SaaS tiers keep the card dashboard untouched.

**Architecture:** Mask change, not a data-model change: root folders ARE events underneath. One new server action (`createArchiveFolderAction`) inserts an event directly with business defaults (no credit RPC, no ledger). `DashboardPage` branches on `tenant.plan === "business"` to render a new `_archive-explorer.tsx` client component; clicking a tile lands on the existing event page (piece-1 folder browse), whose breadcrumb gains a link back to the explorer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase service-role insert, existing piece-1 explorer UI.

**Spec:** [docs/superpowers/specs/2026-06-11-business-archive-dashboard-design.md](../specs/2026-06-11-business-archive-dashboard-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/actions/archive.ts` | Create | `createArchiveFolderAction` — business-gated, free event insert with archive defaults |
| `app/dashboard/_archive-explorer.tsx` | Create | Client explorer: search, folder tiles, create-folder modal |
| `app/dashboard/page.tsx` | Modify | Fetch photo counts; branch business → explorer, else existing cards |
| `app/dashboard/events/[id]/page.tsx` | Modify | Pass `eventName` to `PhotoGallery` |
| `app/dashboard/events/[id]/_photo-gallery.tsx` | Modify | Breadcrumb: `คลัง` (Link → /dashboard) `›` event name (`setPath("")`) |

No migration. No new tests (no new pure logic — the action is thin glue over an insert; verified via build + app checklist). Existing 105 tests must stay green.

---

## Task 1: `createArchiveFolderAction`

**Files:**
- Create: `lib/actions/archive.ts`

- [ ] **Step 1: Write the action**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Archive folders are events underneath (mask change — see the spec). Business
// creates them FREE: direct insert, no credit RPC, no ledger entry. Pricing is
// #B-06's decision; flipping this back = changing this one action.
//
// Defaults rationale (spec "Decisions"):
//   tier 'studio'            — must satisfy events.tier check constraint
//   storage_limit_gb 100     — roomy sync quota for an archive folder
//   link_active_days 7       — share links still re-issuable per event
//   data_retention_days 3650 — guards the guest page's isDataExpired
//                              (it ignores unlimited-retention plans — known bug)
//   activated_at now()       — downstream flows treat the event as active
const ARCHIVE_FOLDER_DEFAULTS = {
  tier: "studio",
  storage_limit_gb: 100,
  link_active_days: 7,
  data_retention_days: 3650,
} as const;

export async function createArchiveFolderAction(formData: FormData): Promise<{ eventId: string }> {
  const ctx = await getCurrentTenant();
  if (!ctx) throw new Error("ต้องเข้าสู่ระบบ");
  if (ctx.tenant.plan !== "business") {
    throw new Error("สร้างแฟ้มคลังได้เฉพาะแพ็กเกจ Business");
  }

  const name = (formData.get("name") as string)?.trim();
  const eventDate = (formData.get("event_date") as string)?.trim() || null;
  if (!name) throw new Error("กรุณาตั้งชื่อแฟ้ม");
  if (name.length > 120) throw new Error("ชื่อแฟ้มยาวเกิน 120 ตัวอักษร");

  const admin = createServiceRoleClient();
  const { data: event, error } = await admin
    .from("events")
    .insert({
      tenant_id: ctx.tenant.id,
      name,
      event_date: eventDate,
      ...ARCHIVE_FOLDER_DEFAULTS,
      credits_used: 0,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !event) throw new Error(error?.message ?? "สร้างแฟ้มไม่สำเร็จ");

  revalidatePath("/dashboard");
  return { eventId: event.id };
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/archive.ts
git commit -m "feat(archive): createArchiveFolderAction — free business folder = event underneath"
```

---

## Task 2: `_archive-explorer.tsx` client component

**Files:**
- Create: `app/dashboard/_archive-explorer.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderIcon, FolderPlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { createArchiveFolderAction } from "@/lib/actions/archive";

export type ArchiveFolderRow = {
  id: string;
  name: string;
  event_date: string | null;
  photoCount: number;
};

// Root file-explorer for business tenants: every event = a root folder.
// Clicking a tile opens the event page (the piece-1 folder browse).
export function ArchiveExplorer({ folders }: { folders: ArchiveFolderRow[] }) {
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = q.trim()
    ? folders.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
    : folders;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
            Archive
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
            คลัง
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-none bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49f2e] transition-colors"
        >
          <FolderPlusIcon className="h-4 w-4" />
          สร้างแฟ้ม
        </button>
      </header>

      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นชื่อแฟ้ม…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <FolderIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {q ? `ไม่พบแฟ้มชื่อ "${q}"` : "ยังไม่มีแฟ้ม — กดสร้างแฟ้มแล้วเชื่อมโฟลเดอร์เพื่อเริ่มเก็บรูป"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/events/${f.id}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 hover:border-[#D4AF37] transition-colors"
            >
              <FolderIcon className="h-9 w-9 shrink-0 text-[#D4AF37]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{f.name}</p>
                <p className="text-xs text-zinc-400">
                  {f.event_date
                    ? new Date(f.event_date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
                    : "ไม่ระบุวันที่"}
                  {" · "}
                  {f.photoCount} รูป
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {createOpen && <CreateFolderModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateFolderModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("event_date", date);
        const { eventId } = await createArchiveFolderAction(fd);
        router.push(`/dashboard/events/${eventId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "สร้างแฟ้มไม่สำเร็จ");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">สร้างแฟ้มใหม่</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อแฟ้ม เช่น สงกรานต์ 2026"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          autoFocus
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        <p className="text-xs text-zinc-500">สร้างแล้วเข้าไปเชื่อมโฟลเดอร์ Drive/Dropbox แล้วกด Sync ได้เลย — ไม่หักเครดิต</p>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-mono tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all disabled:opacity-40"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="rounded bg-[#D4AF37] px-4 py-1.5 text-xs font-mono font-semibold tracking-wider text-black hover:bg-[#c49f2e] transition-all disabled:opacity-60"
          >
            {pending ? "กำลังสร้าง…" : "สร้างแฟ้ม"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/_archive-explorer.tsx
git commit -m "feat(archive): ArchiveExplorer — root folder tiles, search, create-folder modal"
```

---

## Task 3: Branch `DashboardPage` (business → explorer)

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Import the explorer**

Add to the imports at the top:

```ts
import { ArchiveExplorer, type ArchiveFolderRow } from "./_archive-explorer";
```

- [ ] **Step 2: Add photo counts to the query and branch before the card UI**

Replace the data-fetch block (currently lines 8–17):

```ts
  const ctx = await getCurrentTenant();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, created_at, cover_image_url, photos(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = events ?? [];

  // Business tier: the dashboard IS a file explorer — every event = a root
  // folder (mask change; see the business-archive-dashboard spec). SaaS tiers
  // keep the card view below.
  if (ctx?.tenant.plan === "business") {
    const folders: ArchiveFolderRow[] = [...list]
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
      .map((e) => ({
        id: e.id,
        name: e.name,
        event_date: e.event_date,
        photoCount: (e.photos as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    return <ArchiveExplorer folders={folders} />;
  }
```

The rest of the function (the `today`/`ongoing`/`past` split and the card JSX) stays exactly as-is — it now only renders for non-business tenants. Note: `photos(count)` rides along harmlessly for the card branch (unused field).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(archive): business dashboard renders ArchiveExplorer instead of event cards"
```

---

## Task 4: Breadcrumb link-back (`คลัง` → /dashboard)

**Files:**
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`
- Modify: `app/dashboard/events/[id]/page.tsx`

- [ ] **Step 1: Add the `eventName` prop to `PhotoGallery`**

In `_photo-gallery.tsx`, extend `Props` and the signature:

```ts
type Props = {
  eventId: string;
  eventName: string;
  photos: GalleryPhoto[];
};

export function PhotoGallery({ eventId, eventName, photos }: Props) {
```

Add the `Link` import next to the existing next imports:

```ts
import Link from "next/link";
```

- [ ] **Step 2: Rework the breadcrumb root**

In the folder-explorer header block, replace the current root button:

```tsx
            <button
              type="button"
              onClick={() => setPath("")}
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              คลัง
            </button>
```

with a dashboard link + an event-name crumb (matches the approved mockup `คลัง › สงกรานต์ 2024 › …`):

```tsx
            <Link
              href="/dashboard"
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              คลัง
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-400" />
            <button
              type="button"
              onClick={() => setPath("")}
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              {eventName}
            </button>
```

- [ ] **Step 3: Pass the name from the event page**

In `app/dashboard/events/[id]/page.tsx`, find `<PhotoGallery eventId={event.id} photos={photoList} />` and change to:

```tsx
        <PhotoGallery eventId={event.id} eventName={event.name} photos={photoList} />
```

- [ ] **Step 4: Typecheck + lint + tests + build**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors, 105 tests pass.

Run: `npm run build`
Expected: build succeeds; `/dashboard` and `/dashboard/events/[id]` listed.

- [ ] **Step 5: Commit**

```bash
git add "app/dashboard/events/[id]/_photo-gallery.tsx" "app/dashboard/events/[id]/page.tsx"
git commit -m "feat(archive): breadcrumb roots at คลัง (dashboard) › event name › subfolders"
```

---

## Task 5: Verify in app

- [ ] **Step 1: Business explorer**

`npm run dev` → login (tenant plan=business) → `/dashboard` shows the explorer (no cards): existing events as folder tiles with date + photo count, newest first.

- [ ] **Step 2: Free create**

Note credit balance → "สร้างแฟ้ม" → name it → lands on the new event page. Balance unchanged; `credit_ledger` has no new row (check `/dashboard/account/credits` or the admin ledger).

- [ ] **Step 3: Wire + sync**

In the new folder: connect a Drive/Dropbox folder via the existing Sources modal → Sync → photos + subfolders appear (piece 1).

- [ ] **Step 4: Breadcrumb round-trip**

Inside a subfolder: `คลัง` → back to the explorer; event-name crumb → back to that folder's root; browser Back still pops folders (`?path=` unchanged).

- [ ] **Step 5: Search**

Type part of a folder name → tiles filter.

- [ ] **Step 6: SaaS regression**

Login with a free-tier account → `/dashboard` shows the card view + "New event" flow (tier picker + credit deduction) exactly as before.

---

## Self-Review

**Spec coverage:** Goal 1 explorer-at-root → Tasks 2+3 · Goal 2 drill-in + breadcrumb back → Task 4 · Goal 3 free create with defaults → Task 1 (defaults match the spec's Decisions table verbatim) · Goal 4 SaaS untouched → Task 3 keeps card branch + Task 5 Step 6 regression check.

**Placeholders:** none — full code in every step.

**Type consistency:** `ArchiveFolderRow` defined in Task 2, imported in Task 3 ✓ · `createArchiveFolderAction(formData) → { eventId }` defined Task 1, called Task 2 ✓ · `eventName` prop defined and passed in Task 4 ✓ · `ChevronRightIcon`/`FolderIcon` already imported in `_photo-gallery.tsx` from piece 1 ✓.

**Known notes:** `photos(count)` embed unused in the SaaS branch (harmless); guest-page `isDataExpired` plan bug tracked separately (spawned task).

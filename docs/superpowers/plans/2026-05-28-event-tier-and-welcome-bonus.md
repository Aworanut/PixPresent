# Event Tier & Welcome Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม tier system ระดับ event (Starter/Gallery/Studio), config ใน `lib/credit-packages.ts`, welcome bonus 199 credits ตอน signup, และแสดง credit balance ในหน้า dashboard

**Architecture:** Tier config อยู่ใน `lib/credit-packages.ts` เป็น source of truth สำหรับทุก constraint — migration ดึงค่าจาก config เดียวกัน, form แสดง pricing จาก config, action validate ด้วย config. Welcome bonus ทำผ่าน Postgres trigger (SECURITY DEFINER) ที่ run ตอน tenant row ถูกสร้าง

**Tech Stack:** Next.js Server Actions, Supabase (Postgres trigger, migration), TypeScript, Tailwind CSS / shadcn/ui

---

## File Map

| File | Action | ทำอะไร |
|---|---|---|
| `lib/credit-packages.ts` | **CREATE** | Tier config — limits + costs, source of truth |
| `supabase/migrations/20260528040000_event_tier.sql` | **CREATE** | เพิ่ม tier columns ใน events, update credit_ledger reason constraint |
| `supabase/migrations/20260528050000_welcome_bonus_trigger.sql` | **CREATE** | Update handle_new_user() ให้แจก 199 credits ตอน signup |
| `app/dashboard/events/_components/event-form.tsx` | **MODIFY** | เพิ่ม tier selector (เฉพาะ create — ไม่ include ใน edit) |
| `lib/actions/events.ts` | **MODIFY** | `createEvent` save tier + computed limits จาก config |
| `app/dashboard/layout.tsx` | **MODIFY** | แสดง credit balance ในหน้า header |

---

## Task 1: Tier Config File

**Files:**
- Create: `lib/credit-packages.ts`

- [ ] **Step 1.1: สร้าง tier config**

```typescript
// lib/credit-packages.ts

export type EventTier = "starter" | "gallery" | "studio";

export type TierConfig = {
  creditCost: number;
  storageLimitGb: number;
  linkActiveDays: number;
  dataRetentionDays: number;
  label: string;
  description: string;
};

export const TIER_CONFIG: Record<EventTier, TierConfig> = {
  starter: {
    creditCost: 199,
    storageLimitGb: 5,
    linkActiveDays: 3,
    dataRetentionDays: 7,
    label: "Starter",
    description: "5 GB · link 3 วัน · เก็บข้อมูล 7 วัน",
  },
  gallery: {
    creditCost: 499,
    storageLimitGb: 20,
    linkActiveDays: 5,
    dataRetentionDays: 14,
    label: "Gallery",
    description: "20 GB · link 5 วัน · เก็บข้อมูล 14 วัน",
  },
  studio: {
    creditCost: 999,
    storageLimitGb: 50,
    linkActiveDays: 7,
    dataRetentionDays: 30,
    label: "Studio",
    description: "50 GB · link 7 วัน · เก็บข้อมูล 30 วัน · Highlight Reel",
  },
};

export const WELCOME_BONUS_CREDITS = 199;

export const EVENT_TIERS = Object.keys(TIER_CONFIG) as EventTier[];

export function isValidTier(value: string): value is EventTier {
  return EVENT_TIERS.includes(value as EventTier);
}
```

- [ ] **Step 1.2: Commit**

```bash
git add lib/credit-packages.ts
git commit -m "feat: add tier config (Starter/Gallery/Studio) and welcome bonus constant"
```

---

## Task 2: Database Migration — Event Tier Columns

**Files:**
- Create: `supabase/migrations/20260528040000_event_tier.sql`

- [ ] **Step 2.1: สร้าง migration file**

```sql
-- supabase/migrations/20260528040000_event_tier.sql
-- =============================================================================
-- Event tier system (#12)
-- เพิ่ม tier columns ใน events + update credit_ledger reason constraint
-- =============================================================================

-- 1. เพิ่ม tier columns ใน events
alter table public.events
  add column tier               text not null default 'starter'
    check (tier in ('starter', 'gallery', 'studio')),
  add column storage_limit_gb   integer not null default 5
    check (storage_limit_gb > 0),
  add column link_active_days   integer not null default 3
    check (link_active_days > 0),
  add column data_retention_days integer not null default 7
    check (data_retention_days > 0);

comment on column public.events.tier is
  'Event tier: starter (199cr) | gallery (499cr) | studio (999cr)';
comment on column public.events.storage_limit_gb is
  'Max storage for this event in GB — set from tier at creation time';
comment on column public.events.link_active_days is
  'How long the guest share link is active after activation';
comment on column public.events.data_retention_days is
  'How long photos are kept after link expires';

-- 2. Update credit_ledger reason constraint เพื่อรองรับ welcome_bonus
alter table public.credit_ledger
  drop constraint if exists credit_ledger_reason_check;

alter table public.credit_ledger
  add constraint credit_ledger_reason_check
    check (reason in (
      'topup_slip',
      'activate_event',
      'refund',
      'adjustment',
      'welcome_bonus'
    ));
```

- [ ] **Step 2.2: รัน migration บน local Supabase**

```bash
supabase db reset
```

Expected: migration runs without error, `\d public.events` shows tier columns

- [ ] **Step 2.3: Verify columns ด้วย query**

```bash
supabase db execute --local \
  "select column_name, data_type, column_default from information_schema.columns where table_name = 'events' and column_name in ('tier','storage_limit_gb','link_active_days','data_retention_days') order by column_name;"
```

Expected: 4 rows returned

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260528040000_event_tier.sql
git commit -m "feat: add tier columns to events and welcome_bonus to credit_ledger reasons"
```

---

## Task 3: Welcome Bonus Trigger

**Files:**
- Create: `supabase/migrations/20260528050000_welcome_bonus_trigger.sql`

- [ ] **Step 3.1: สร้าง migration**

```sql
-- supabase/migrations/20260528050000_welcome_bonus_trigger.sql
-- =============================================================================
-- Update handle_new_user() to grant 199 welcome bonus credits (#12)
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_welcome    integer := 199;
begin
  -- 1. สร้าง tenant row
  insert into public.tenants (owner_user_id, name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  returning id into v_tenant_id;

  -- 2. อัปเดต credit_balance ก่อน insert ledger
  update public.tenants
  set credit_balance = v_welcome
  where id = v_tenant_id;

  -- 3. บันทึก credit_ledger สำหรับ welcome bonus
  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, note)
  values
    (v_tenant_id, v_welcome, v_welcome, 'welcome_bonus', 'Welcome bonus on signup');

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-creates public.tenants row and grants 199 welcome bonus credits on signup.';
```

- [ ] **Step 3.2: รัน migration + verify**

```bash
supabase db reset
```

- [ ] **Step 3.3: Test ด้วย SQL — simulate new user**

```bash
supabase db execute --local "
  -- create fake auth user + verify tenant + ledger
  do \$\$
  declare
    fake_uid uuid := gen_random_uuid();
    t_id uuid;
  begin
    -- เรียก function โดยตรง
    insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at, aud, role)
    values (fake_uid, 'test@example.com', '{\"organization_name\": \"Test Org\"}'::jsonb,
            now(), now(), 'authenticated', 'authenticated');
    select id into t_id from public.tenants where owner_user_id = fake_uid;
    assert t_id is not null, 'tenant not created';
    assert (select credit_balance from public.tenants where id = t_id) = 199,
           'credit_balance should be 199';
    assert (select count(*) from public.credit_ledger where tenant_id = t_id and reason = 'welcome_bonus') = 1,
           'ledger row missing';
    raise notice 'Welcome bonus test PASSED';
  end;
  \$\$;
"
```

Expected: `NOTICE: Welcome bonus test PASSED`

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/20260528050000_welcome_bonus_trigger.sql
git commit -m "feat: grant 199 welcome bonus credits on tenant signup"
```

---

## Task 4: Tier Selector ใน Event Form

**Files:**
- Modify: `app/dashboard/events/_components/event-form.tsx`
- Modify: `lib/actions/events.ts`

- [ ] **Step 4.1: เพิ่ม tier prop ใน EventFormProps และ tier selector UI**

แก้ `app/dashboard/events/_components/event-form.tsx`:

```typescript
"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import type { EventActionState } from "@/lib/actions/events";
import { TIER_CONFIG, EVENT_TIERS, type EventTier } from "@/lib/credit-packages";

type FormAction = (
  prev: EventActionState,
  formData: FormData,
) => Promise<EventActionState>;

export type FolderInput = {
  label: string;
  folder: string;
};

type EventFormProps = {
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  showTierSelector?: boolean;
  defaults?: {
    name?: string | null;
    event_date?: string | null;
    folders?: FolderInput[];
    tier?: EventTier;
  };
  cancelHref: string;
};

export function EventForm({
  action,
  submitLabel,
  pendingLabel,
  showTierSelector = false,
  defaults,
  cancelHref,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [folders, setFolders] = useState<FolderInput[]>(
    defaults?.folders && defaults.folders.length > 0
      ? defaults.folders
      : [{ label: "", folder: "" }],
  );
  const [selectedTier, setSelectedTier] = useState<EventTier>(
    defaults?.tier ?? "starter",
  );
  const formId = useId();

  const updateRow = (idx: number, key: keyof FolderInput, val: string) => {
    setFolders((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [key]: val } : row)),
    );
  };

  const removeRow = (idx: number) => {
    setFolders((rows) => {
      const next = rows.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ label: "", folder: "" }] : next;
    });
  };

  const addRow = () => {
    setFolders((rows) => [...rows, { label: "", folder: "" }]);
  };

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-name`}>ชื่อ Event</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaults?.name ?? ""}
          placeholder="งานแต่งคุณเอ — 1 มี.ค. 2026"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-date`}>วันจัดงาน</Label>
        <Input
          id={`${formId}-date`}
          name="event_date"
          type="date"
          defaultValue={defaults?.event_date ?? ""}
        />
      </div>

      {showTierSelector && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none mb-1">
            Event Tier
          </legend>
          <input type="hidden" name="tier" value={selectedTier} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {EVENT_TIERS.map((tier) => {
              const cfg = TIER_CONFIG[tier];
              const isSelected = selectedTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={[
                    "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{cfg.label}</span>
                    <span className="text-sm font-bold">{cfg.creditCost} cr</span>
                  </div>
                  <span className={[
                    "text-xs leading-snug",
                    isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400",
                  ].join(" ")}>
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none mb-1">
          Google Drive folders
        </legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ใส่ลิงก์หรือ ID ของ folder ที่ช่างภาพอัพรูปเข้ามา — เพิ่มได้หลายอัน
        </p>

        <ul className="space-y-2">
          {folders.map((row, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                <Input
                  name="folder_labels[]"
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(idx, "label", e.target.value)}
                  placeholder="Label (เช่น ทีมหลัก)"
                  maxLength={60}
                  aria-label={`Folder ${idx + 1} label`}
                />
                <Input
                  name="folder_ids[]"
                  type="text"
                  value={row.folder}
                  onChange={(e) => updateRow(idx, "folder", e.target.value)}
                  placeholder="URL หรือ Folder ID"
                  aria-label={`Folder ${idx + 1} URL or ID`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`ลบ folder ${idx + 1}`}
                onClick={() => removeRow(idx)}
                disabled={folders.length === 1 && !row.folder && !row.label}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + เพิ่ม folder
        </Button>
      </fieldset>

      {state?.error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          aria-disabled={pending}
          className={buttonVariants({ variant: "ghost" })}
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 4.2: อัพเดท `createEvent` action ให้ save tier + limits**

แก้ `lib/actions/events.ts` — อัพเดท import และ `parseForm` + `createEvent`:

เพิ่ม import ด้านบน (หลัง `import { extractDriveFolderId }...`):
```typescript
import { isValidTier, TIER_CONFIG, type EventTier } from "@/lib/credit-packages";
```

อัพเดท `ParsedForm` type:
```typescript
type ParsedForm = {
  name: string;
  event_date: string | null;
  folders: ParsedFolder[];
  tier: EventTier;
};
```

อัพเดท `parseForm` function:
```typescript
function parseForm(formData: FormData): ParsedForm {
  const name = String(formData.get("name") ?? "").trim();
  const event_date = String(formData.get("event_date") ?? "").trim() || null;
  const rawTier = String(formData.get("tier") ?? "starter");
  const tier: EventTier = isValidTier(rawTier) ? rawTier : "starter";

  const labels = formData.getAll("folder_labels[]").map((v) => String(v).trim());
  const rawIds = formData.getAll("folder_ids[]").map((v) => String(v).trim());

  const folders: ParsedFolder[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawIds.length; i++) {
    const folder_id = extractDriveFolderId(rawIds[i]);
    if (!folder_id || seen.has(folder_id)) continue;
    seen.add(folder_id);
    folders.push({ label: labels[i] ?? "", folder_id });
  }

  return { name, event_date, folders, tier };
}
```

อัพเดท `createEvent` — แก้เฉพาะ insert events block:
```typescript
  const tierCfg = TIER_CONFIG[input.tier];
  const { data: created, error } = await supabase
    .from("events")
    .insert({
      tenant_id: tenant.id,
      name: input.name,
      event_date: input.event_date,
      tier: input.tier,
      storage_limit_gb: tierCfg.storageLimitGb,
      link_active_days: tierCfg.linkActiveDays,
      data_retention_days: tierCfg.dataRetentionDays,
    })
    .select("id")
    .single();
```

- [ ] **Step 4.3: เปิด tier selector ใน new event page**

ตรวจสอบไฟล์ `app/dashboard/events/new/page.tsx`:

```bash
cat app/dashboard/events/new/page.tsx
```

หาก EventForm ถูกใช้งาน เพิ่ม prop `showTierSelector={true}` เข้าไป:
```tsx
<EventForm
  action={createEvent}
  submitLabel="สร้าง Event"
  pendingLabel="กำลังสร้าง..."
  showTierSelector={true}
  cancelHref="/dashboard"
/>
```

- [ ] **Step 4.4: Regenerate TypeScript types จาก schema**

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

- [ ] **Step 4.5: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 4.6: Commit**

```bash
git add app/dashboard/events/_components/event-form.tsx \
        lib/actions/events.ts \
        app/dashboard/events/new/page.tsx \
        lib/supabase/types.ts
git commit -m "feat: add tier selector to event creation form and save tier limits"
```

---

## Task 5: Credit Balance Indicator ในหน้า Dashboard

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 5.1: เพิ่ม credit balance ใน header**

แก้ `app/dashboard/layout.tsx` — เพิ่ม credit indicator ใน header:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/login");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium tracking-wider uppercase text-zinc-900 dark:text-zinc-100"
          >
            PixPresent
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {ctx.tenant.credit_balance.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">cr</span>
            </div>

            <Link
              href="/dashboard/account"
              className="hidden sm:flex flex-col items-end leading-tight hover:opacity-70 transition-opacity"
            >
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {ctx.tenant.name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {ctx.user.email}
              </span>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5.2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 5.3: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat: show credit balance in dashboard header"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** config ✓, migration ✓, welcome bonus ✓, tier selector ✓, credit indicator ✓
- [x] **No placeholders:** ทุก step มี code จริง
- [x] **Type consistency:** `EventTier` import จาก `lib/credit-packages.ts` ใช้ consistent ทุกไฟล์
- [x] **credit_ledger reason:** migration อัพเดท constraint ให้รองรับ `'welcome_bonus'` ก่อน trigger ใช้งาน
- [x] **Edit form:** ไม่แตะ — tier ไม่ควรเปลี่ยนหลังสร้าง event แล้ว (YAGNI)
- [x] **Task order:** Task 1 (config) → Task 2 (migration) → Task 3 (trigger) — sequential dependency ถูกต้อง

# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Super Admin console at `/admin` — env-allowlist guard, left-sidebar shell, dashboard home (4 stat cards), a professional table + right-drawer for slip approvals, and tenant management with attributable credit adjustment.

**Architecture:** Next.js 16 App Router server components fetch data via `createServiceRoleClient()` (bypasses RLS). Interactivity (row→drawer, confirm-before-action) lives in small `"use client"` components. Privileged writes go through SECURITY DEFINER RPCs called service-role-only. A new migration adds an attributable `credit_ledger.actor_user_id` and an `adjust_credit` RPC, and extends the existing approve/reject RPCs with an optional actor.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + RLS + RPC), Tailwind v4, lucide-react, vitest.

**Scope note — this is Plan 1 of 2.** Plan 2 (person-first identity + expanded tenant profile/billing + guest photographer-credit) is a separate subsystem (it touches signup, guest display, and ~6 `tenant.name` sites) and is outlined at the bottom. This plan delivers a working admin console on its own using the data that exists today.

**Baked-in decisions** (from the grill; redirect if any are wrong):
- Admin access = env `SUPER_ADMIN_EMAILS` allowlist + service-role reads (see `docs/adr/0001-admin-access-env-email-allowlist.md`), **not** `is_super_admin()` JWT/RLS.
- Admin can **read** tenants and **adjust credit**; admin does **not** edit a tenant's personal/billing profile here (that's organizer self-service in Plan 2).
- Every manual movement is **attributable**: manual approve/reject sets `slip_uploads.verified_by`; adjustments set `credit_ledger.actor_user_id`. Auto (SlipOK) stays NULL.
- Actions are guarded by an **inline confirm** ("กันพลาด"), not a one-click fire.
- **No new emails** in this plan (Q10).

---

## File Structure

**Create:**
- `lib/auth/super-admin.ts` — env allowlist parsing + `isSuperAdminEmail()` + `getPrimaryAdminEmail()`.
- `__tests__/super-admin.test.ts` — unit tests for the allowlist helper.
- `supabase/migrations/20260529100000_admin_audit_and_adjust.sql` — ledger actor column, `adjust_credit` RPC, actor params on approve/reject.
- `components/ui/drawer.tsx` — reusable right-side drawer (hand-rolled, ESC + backdrop close).
- `components/ui/confirm-button.tsx` — reusable inline two-step confirm button.
- `app/admin/_sidebar.tsx` — client sidebar nav with active-link state.
- `app/admin/_stat-card.tsx` — dashboard stat card.
- `app/admin/page.tsx` — dashboard home (4 stat cards).
- `app/admin/slips/_slips-table.tsx` — client table + drawer orchestration (exports `SlipRow`, `PKG_LABEL`, `fmt`).
- `app/admin/slips/_slip-drawer.tsx` — client slip detail drawer + approve/reject.
- `app/admin/tenants/page.tsx` — tenants list (server).
- `app/admin/tenants/_tenants-table.tsx` — client table + drawer orchestration (exports `TenantRow`).
- `app/admin/tenants/_tenant-drawer.tsx` — client tenant detail drawer + adjust form.
- `app/admin/tenants/_actions.ts` — `getTenantLedger`, `adjustCredit` server actions.

**Modify:**
- `lib/payment-config.ts` — remove `ADMIN_EMAIL`.
- `lib/email/notifications.ts` — use `getPrimaryAdminEmail()` instead of `ADMIN_EMAIL`.
- `app/admin/layout.tsx` — env guard + sidebar shell.
- `app/admin/slips/page.tsx` — rebuild as table feeding `SlipsTable`.
- `app/admin/slips/_actions.ts` — pass actor into RPCs.
- `lib/supabase/types.ts` — regenerated after the migration.
- `.env.local` — add `SUPER_ADMIN_EMAILS` (manual; not committed).

**Delete:**
- `app/admin/slips/_slip-actions.tsx` — replaced by the drawer.

---

## Task 1: Super-admin allowlist config

**Files:**
- Create: `lib/auth/super-admin.ts`
- Test: `__tests__/super-admin.test.ts`
- Modify: `lib/payment-config.ts`, `lib/email/notifications.ts`, `app/admin/layout.tsx` (guard only — sidebar comes in Task 3)
- Manual: `.env.local`

- [ ] **Step 1: Write the failing test**

Create `__tests__/super-admin.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import {
  isSuperAdminEmail,
  getPrimaryAdminEmail,
  getSuperAdminEmails,
} from "@/lib/auth/super-admin";

describe("super-admin allowlist", () => {
  const original = process.env.SUPER_ADMIN_EMAILS;
  afterEach(() => {
    process.env.SUPER_ADMIN_EMAILS = original;
  });

  it("returns false when env unset", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(isSuperAdminEmail("a@b.com")).toBe(false);
  });

  it("matches a single configured email case-insensitively", () => {
    process.env.SUPER_ADMIN_EMAILS = "Owner@Example.com";
    expect(isSuperAdminEmail("owner@example.com")).toBe(true);
    expect(isSuperAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
  });

  it("matches any email in a comma-separated list", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@x.com, b@y.com ,c@z.com";
    expect(getSuperAdminEmails()).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(isSuperAdminEmail("b@y.com")).toBe(true);
    expect(isSuperAdminEmail("d@w.com")).toBe(false);
  });

  it("returns false for null/undefined/empty email", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@x.com";
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
    expect(isSuperAdminEmail("")).toBe(false);
  });

  it("primary admin email is the first entry", () => {
    process.env.SUPER_ADMIN_EMAILS = "first@x.com,second@y.com";
    expect(getPrimaryAdminEmail()).toBe("first@x.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/super-admin.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/super-admin"`.

- [ ] **Step 3: Implement the helper**

Create `lib/auth/super-admin.ts`:

```ts
// Read+parse at call time (not module load) so behavior tracks env in tests
// and across server invocations.
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}

export function getPrimaryAdminEmail(): string {
  return getSuperAdminEmails()[0] ?? "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/super-admin.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Remove `ADMIN_EMAIL` and rewire callers**

In `lib/payment-config.ts`, delete the line:

```ts
export const ADMIN_EMAIL = "woranut.ak@gmail.com";
```

In `lib/email/notifications.ts`, replace the import and both usages:

```ts
// at top — replace: import { ADMIN_EMAIL } from "@/lib/payment-config";
import { getPrimaryAdminEmail } from "@/lib/auth/super-admin";
```

```ts
// line ~44 — the Resend "to" field:
to: getPrimaryAdminEmail(),
```

```ts
// line ~138 — the support line in the organizer email body:
กรุณาติดต่อ ${getPrimaryAdminEmail()} หากมีข้อสงสัย
```

In `app/admin/layout.tsx`, swap the guard (leave the rest for Task 3):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isSuperAdminEmail(user?.email)) redirect("/dashboard");
  return <>{children}</>;
}
```

- [ ] **Step 6: Add the env var (manual)**

Add to `.env.local` (and later to Vercel project env for prod):

```
SUPER_ADMIN_EMAILS=woranut.ak@gmail.com
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `ADMIN_EMAIL` is still referenced anywhere, tsc will point to it — fix that import too.)

- [ ] **Step 8: Commit**

```bash
git add lib/auth/super-admin.ts __tests__/super-admin.test.ts lib/payment-config.ts lib/email/notifications.ts app/admin/layout.tsx
git commit -m "feat(admin): env SUPER_ADMIN_EMAILS allowlist, drop hardcoded ADMIN_EMAIL"
```

---

## Task 2: DB migration — attributable ledger + adjust_credit RPC

**Files:**
- Create: `supabase/migrations/20260529100000_admin_audit_and_adjust.sql`
- Modify (generated): `lib/supabase/types.ts`

> **Important:** `approve_topup_credit(uuid)` and `reject_topup(uuid, text)` are replaced with new signatures that add `p_actor`. We `drop function` the old ones first — adding a defaulted arg via `create or replace` would create an *overload* and make the 1-arg call ambiguous. Existing callers pass params by name and resolve to the new functions via the `default null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260529100000_admin_audit_and_adjust.sql`:

```sql
-- =============================================================================
-- #19 Admin dashboard — attributable ledger + manual credit adjustment
--   1. credit_ledger.actor_user_id (who made a manual movement; NULL = system)
--   2. approve_topup_credit / reject_topup gain p_actor (manual = attributable)
--   3. adjust_credit RPC (reason 'adjustment', always attributed to a Super Admin)
-- =============================================================================

-- 1. Ledger actor -------------------------------------------------------------
alter table public.credit_ledger
  add column actor_user_id uuid references auth.users(id);

comment on column public.credit_ledger.actor_user_id is
  'Super Admin who performed a manual movement (adjustment / manual approve / manual reject). NULL = system or SlipOK auto.';

-- 2. Replace approve/reject with actor-aware signatures -----------------------
drop function if exists public.approve_topup_credit(uuid);
drop function if exists public.reject_topup(uuid, text);

create or replace function public.approve_topup_credit(
  p_slip_id uuid,
  p_actor   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip    slip_uploads%rowtype;
  v_balance integer;
begin
  select * into v_slip from public.slip_uploads where id = p_slip_id for update;
  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;
  if v_slip.status <> 'pending' then
    raise exception 'slip_not_pending: slip_id=% is not in pending status', p_slip_id;
  end if;

  -- p_actor NULL => auto-approved by SlipOK; non-NULL => manual admin reviewer
  update public.slip_uploads
     set status = 'approved', verified_at = now(), verified_by = p_actor
   where id = p_slip_id;

  select credit_balance into v_balance from public.tenants
   where id = v_slip.tenant_id for update;
  if not found then
    raise exception 'tenant_not_found: tenant_id=% does not exist', v_slip.tenant_id;
  end if;

  v_balance := v_balance + v_slip.credits_claimed;

  update public.tenants set credit_balance = v_balance where id = v_slip.tenant_id;

  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note, actor_user_id)
  values
    (v_slip.tenant_id, v_slip.credits_claimed, v_balance, 'topup_slip', p_slip_id,
     case when p_actor is null then 'Auto-approved via SlipOK'
          else 'Manually approved by Super Admin' end,
     p_actor);
end;
$$;

comment on function public.approve_topup_credit(uuid, uuid) is
  'Approves a pending slip and credits the tenant. p_actor NULL = SlipOK auto; non-NULL = manual admin. Service-role only.';

revoke execute on function public.approve_topup_credit(uuid, uuid) from public;
revoke execute on function public.approve_topup_credit(uuid, uuid) from anon;
revoke execute on function public.approve_topup_credit(uuid, uuid) from authenticated;

create or replace function public.reject_topup(
  p_slip_id uuid,
  p_reason  text,
  p_actor   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip slip_uploads%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'reject_topup: reason must not be empty';
  end if;

  select * into v_slip from public.slip_uploads where id = p_slip_id for update;
  if not found then
    raise exception 'slip_not_found: slip_id=% does not exist', p_slip_id;
  end if;
  if v_slip.status <> 'pending' then
    raise exception 'slip_not_pending: slip_id=% is already %', p_slip_id, v_slip.status;
  end if;

  update public.slip_uploads
     set status = 'rejected', reject_reason = p_reason, verified_at = now(), verified_by = p_actor
   where id = p_slip_id;
end;
$$;

comment on function public.reject_topup(uuid, text, uuid) is
  'Rejects a pending slip with a reason. p_actor = admin who rejected (NULL = auto). Service-role only.';

revoke execute on function public.reject_topup(uuid, text, uuid) from public;
revoke execute on function public.reject_topup(uuid, text, uuid) from anon;
revoke execute on function public.reject_topup(uuid, text, uuid) from authenticated;

-- 3. adjust_credit ------------------------------------------------------------
create or replace function public.adjust_credit(
  p_tenant_id uuid,
  p_delta     integer,
  p_note      text,
  p_actor     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_actor is null then
    raise exception 'adjust_credit: actor (Super Admin) is required';
  end if;
  if p_note is null or trim(p_note) = '' then
    raise exception 'adjust_credit: note must not be empty';
  end if;
  if p_delta = 0 then
    raise exception 'adjust_credit: delta must be non-zero';
  end if;

  select credit_balance into v_balance from public.tenants
   where id = p_tenant_id for update;
  if not found then
    raise exception 'tenant_not_found: tenant_id=% does not exist', p_tenant_id;
  end if;

  v_balance := v_balance + p_delta;
  if v_balance < 0 then
    raise exception 'insufficient_balance: adjustment would make balance negative';
  end if;

  update public.tenants set credit_balance = v_balance where id = p_tenant_id;

  insert into public.credit_ledger
    (tenant_id, delta, balance_after, reason, ref_id, note, actor_user_id)
  values
    (p_tenant_id, p_delta, v_balance, 'adjustment', null, p_note, p_actor);
end;
$$;

comment on function public.adjust_credit(uuid, integer, text, uuid) is
  'Manual credit adjustment by a Super Admin. delta may be + or -. Writes an attributable adjustment ledger row. Service-role only.';

revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from public;
revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from anon;
revoke execute on function public.adjust_credit(uuid, integer, text, uuid) from authenticated;
```

- [ ] **Step 2: Apply the migration to the local DB**

With the local stack running (`npm run dev` starts it, or `npm run dev:db`):
Run: `supabase migration up`
Expected: applies `20260529100000_admin_audit_and_adjust` with no error.
(If the stack drifted, `npm run db:reset` replays all migrations from scratch.)

- [ ] **Step 3: Verify behavior with SQL**

Run this in Supabase Studio SQL editor (local) or psql. Expected results in comments:

```sql
-- adjust_credit requires an actor:
select public.adjust_credit(
  (select id from public.tenants limit 1), 100, 'test top', null);
-- Expected: ERROR  adjust_credit: actor (Super Admin) is required

-- happy path (replace <ADMIN_UUID> with any auth.users id):
select public.adjust_credit(
  (select id from public.tenants limit 1), 100, 'goodwill comp', '<ADMIN_UUID>');
-- Expected: success; then:
select delta, reason, note, actor_user_id from public.credit_ledger
  order by created_at desc limit 1;
-- Expected: 100 | adjustment | goodwill comp | <ADMIN_UUID>

-- over-withdraw guard:
select public.adjust_credit(
  (select id from public.tenants limit 1), -999999, 'too much', '<ADMIN_UUID>');
-- Expected: ERROR  insufficient_balance: ...
```

- [ ] **Step 4: Regenerate types + typecheck**

Run: `npm run db:types`
Run: `npx tsc --noEmit`
Expected: `lib/supabase/types.ts` updated with the new RPC signatures; no type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260529100000_admin_audit_and_adjust.sql lib/supabase/types.ts
git commit -m "feat(admin): attributable ledger actor + adjust_credit RPC + actor on approve/reject"
```

---

## Task 3: Reusable UI primitives — Drawer + ConfirmButton

These two client components are shared by the slips and tenants drawers. Hand-rolled (Tailwind + state) to match the existing hand-rolled style and avoid a Dialog-library API dependency. No unit tests (pure presentational); verified visually in Task 5/6.

**Files:**
- Create: `components/ui/drawer.tsx`
- Create: `components/ui/confirm-button.tsx`

- [ ] **Step 1: Create the Drawer**

Create `components/ui/drawer.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`absolute right-0 top-0 h-full w-full max-w-md flex flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Create the ConfirmButton**

Create `components/ui/confirm-button.tsx`:

```tsx
"use client";

import { useState } from "react";

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "ยืนยัน",
  pendingLabel = "…",
  className = "",
  disabled = false,
}: {
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-zinc-500">แน่ใจ?</span>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm();
            } finally {
              setLoading(false);
              setArmed(false);
            }
          }}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? pendingLabel : confirmLabel}
        </button>
        <button
          disabled={loading}
          onClick={() => setArmed(false)}
          className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
        >
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <button disabled={disabled} onClick={() => setArmed(true)} className={className}>
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/drawer.tsx components/ui/confirm-button.tsx
git commit -m "feat(ui): reusable Drawer + inline ConfirmButton primitives"
```

---

## Task 4: Admin shell (sidebar) + dashboard home

**Files:**
- Create: `app/admin/_sidebar.tsx`
- Modify: `app/admin/layout.tsx` (add shell around the Task 1 guard)
- Create: `app/admin/_stat-card.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create the sidebar**

Create `app/admin/_sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ReceiptText, Building2 } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/slips", label: "Slips", icon: ReceiptText },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-5 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Super Admin
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-400">{email}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Wrap the layout in the shell**

Replace `app/admin/layout.tsx` with (keeps the Task 1 guard):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import { AdminSidebar } from "./_sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isSuperAdminEmail(user?.email)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar email={user!.email ?? ""} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create the stat card**

Create `app/admin/_stat-card.tsx`:

```tsx
export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "amber" | "default";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          accent === "amber"
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create the dashboard home**

Create `app/admin/page.tsx`:

```tsx
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StatCard } from "./_stat-card";

export default async function AdminDashboardPage() {
  const admin = createServiceRoleClient();

  const [pending, tenants, events, balances] = await Promise.all([
    admin
      .from("slip_uploads")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.from("tenants").select("id", { count: "exact", head: true }),
    admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin.from("tenants").select("credit_balance"),
  ]);

  const outstanding = (balances.data ?? []).reduce(
    (sum, t) => sum + (t.credit_balance ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending slips"
          value={String(pending.count ?? 0)}
          accent="amber"
          hint="รอตรวจสอบ"
        />
        <StatCard label="Tenants" value={String(tenants.count ?? 0)} />
        <StatCard label="Active events" value={String(events.count ?? 0)} />
        <StatCard
          label="Outstanding credit"
          value={`฿${outstanding.toLocaleString()}`}
          hint="ยอดเครดิตคงค้างรวม"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verify**

Run: `npm run dev` → sign in as the allowlisted email → visit `/admin`.
Expected: sidebar on the left (Dashboard active), 4 stat cards with real counts. Visit `/admin` while signed in as a non-allowlisted user → redirected to `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add app/admin/_sidebar.tsx app/admin/layout.tsx app/admin/_stat-card.tsx app/admin/page.tsx
git commit -m "feat(admin): sidebar shell + dashboard home with 4 stat cards"
```

---

## Task 5: Slips — professional table + right drawer + attributable actions

Rebuild `/admin/slips` from cards into a dense table; clicking a row opens the right drawer with the slip image and Approve/Reject (inline-confirmed). Manual approve/reject now passes the admin's user id as the actor.

**Files:**
- Modify: `app/admin/slips/_actions.ts` (pass actor)
- Create: `app/admin/slips/_slips-table.tsx`
- Create: `app/admin/slips/_slip-drawer.tsx`
- Modify: `app/admin/slips/page.tsx` (feed the table)
- Delete: `app/admin/slips/_slip-actions.tsx`

- [ ] **Step 1: Wire the actor into the slip actions**

Replace `app/admin/slips/_actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

async function getActorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function approveSlip(slipId: string): Promise<{ error?: string }> {
  const actor = await getActorId();
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("approve_topup_credit", {
    p_slip_id: slipId,
    p_actor: actor,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  revalidatePath("/admin");
  return {};
}

export async function rejectSlip(
  slipId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: "กรุณากรอกเหตุผล" };
  const actor = await getActorId();
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("reject_topup", {
    p_slip_id: slipId,
    p_reason: reason.trim(),
    p_actor: actor,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/slips");
  revalidatePath("/admin");
  return {};
}
```

- [ ] **Step 2: Create the slips table (client)**

Create `app/admin/slips/_slips-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SlipDrawer } from "./_slip-drawer";

export type SlipRow = {
  id: string;
  tenant_id: string;
  package_id: string;
  amount_thb: number;
  credits_claimed: number;
  slip_image_url: string;
  status: string;
  reject_reason: string | null;
  uploaded_at: string;
  verified_at: string | null;
  tenants: { name: string } | null;
};

export const PKG_LABEL: Record<string, string> = {
  pack_199: "199",
  pack_499: "499",
  pack_999: "999",
  custom: "Custom",
};

export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Badge({ status }: { status: string }) {
  const s: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    approved:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

export function SlipsTable({ slips }: { slips: SlipRow[] }) {
  const [selected, setSelected] = useState<SlipRow | null>(null);

  if (slips.length === 0) {
    return <p className="text-sm text-zinc-500">ไม่มี slip ในระบบ</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
              <th className="px-4 py-2.5 text-left font-medium">Package</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                Uploaded
              </th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {slips.map((slip) => (
              <tr
                key={slip.id}
                onClick={() => setSelected(slip)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {slip.tenants?.name ?? slip.tenant_id}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {PKG_LABEL[slip.package_id] ?? slip.package_id}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  ฿{slip.amount_thb.toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                  {fmt(slip.uploaded_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge status={slip.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlipDrawer slip={selected} onClose={() => setSelected(null)} />
    </>
  );
}
```

- [ ] **Step 3: Create the slip drawer (client)**

Create `app/admin/slips/_slip-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { approveSlip, rejectSlip } from "./_actions";
import { type SlipRow, PKG_LABEL, fmt } from "./_slips-table";

export function SlipDrawer({
  slip,
  onClose,
}: {
  slip: SlipRow | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset transient state when a different slip opens.
  useEffect(() => {
    setReason("");
    setError(null);
  }, [slip?.id]);

  return (
    <Drawer open={slip !== null} onClose={onClose} title="Slip detail">
      {slip && (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {slip.tenants?.name ?? slip.tenant_id}
            </p>
            <p className="text-xs text-zinc-400">{fmt(slip.uploaded_at)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-400">Package</dt>
              <dd className="font-medium">
                {PKG_LABEL[slip.package_id] ?? slip.package_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Amount</dt>
              <dd className="font-medium tabular-nums">
                ฿{slip.amount_thb.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Credits</dt>
              <dd className="font-medium tabular-nums">{slip.credits_claimed}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Status</dt>
              <dd className="font-medium">{slip.status}</dd>
            </div>
          </dl>

          <a href={slip.slip_image_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slip.slip_image_url}
              alt="Slip"
              className="max-h-80 w-full rounded-lg border border-zinc-200 bg-zinc-50 object-contain dark:border-zinc-800 dark:bg-zinc-950"
            />
          </a>

          {slip.status === "pending" && (
            <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <ConfirmButton
                confirmLabel="อนุมัติ"
                pendingLabel="กำลังอนุมัติ…"
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onConfirm={async () => {
                  setError(null);
                  const r = await approveSlip(slip.id);
                  if (r.error) setError(r.error);
                  else onClose();
                }}
              >
                Approve
              </ConfirmButton>

              <div className="space-y-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เหตุผลที่ปฏิเสธ"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <ConfirmButton
                  confirmLabel="ปฏิเสธ"
                  pendingLabel="กำลังปฏิเสธ…"
                  disabled={!reason.trim()}
                  className="w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onConfirm={async () => {
                    setError(null);
                    const r = await rejectSlip(slip.id, reason);
                    if (r.error) setError(r.error);
                    else {
                      setReason("");
                      onClose();
                    }
                  }}
                >
                  Reject
                </ConfirmButton>
              </div>
            </div>
          )}

          {slip.status === "rejected" && slip.reject_reason && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              เหตุผล: {slip.reject_reason}
            </div>
          )}
          {slip.status === "approved" && slip.verified_at && (
            <p className="text-xs text-zinc-400">Approved: {fmt(slip.verified_at)}</p>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 4: Rebuild the page (server) to feed the table**

Replace `app/admin/slips/page.tsx`:

```tsx
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SlipsTable, type SlipRow } from "./_slips-table";

export default async function AdminSlipsPage() {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("slip_uploads")
    .select(
      "id, tenant_id, package_id, amount_thb, credits_claimed, slip_image_url, status, reject_reason, uploaded_at, verified_at, tenants(name)",
    )
    .order("uploaded_at", { ascending: false })
    .limit(200)
    .returns<SlipRow[]>();

  const slips = (data ?? [])
    .slice()
    .sort(
      (a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1),
    );

  const pendingCount = slips.filter((s) => s.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Slip Approvals
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {pendingCount} pending
          </span>{" "}
          / {slips.length} total
        </p>
      </div>
      <SlipsTable slips={slips} />
    </div>
  );
}
```

- [ ] **Step 5: Delete the obsolete card actions**

```bash
git rm app/admin/slips/_slip-actions.tsx
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (If lint flags the `<img>`, confirm the `eslint-disable-next-line` comment sits on the line directly above it.)

- [ ] **Step 7: Manual verify**

Run: `npm run dev` → `/admin/slips`.
Expected: table with pending rows first. Click a pending row → drawer slides in from the right with the slip image. Click **Approve** → "แน่ใจ?" inline confirm → confirm → drawer closes, row flips to approved, tenant balance increases. Reject requires a reason, then inline-confirms. After approving, check the DB: `slip_uploads.verified_by` = your admin user id, and the `credit_ledger` row has `actor_user_id` set and note "Manually approved by Super Admin".

- [ ] **Step 8: Commit**

```bash
git add app/admin/slips/
git commit -m "feat(admin): slips professional table + right drawer + attributable approve/reject"
```

---

## Task 6: Tenant management — table + detail drawer + credit adjustment

Adds `/admin/tenants`: a table of tenants; clicking a row opens a drawer with the tenant's balance, recent ledger, and an inline-confirmed credit Adjustment form (writes an attributable `adjustment` ledger row via the Task 2 RPC).

**Files:**
- Create: `app/admin/tenants/_actions.ts`
- Create: `app/admin/tenants/_tenants-table.tsx`
- Create: `app/admin/tenants/_tenant-drawer.tsx`
- Create: `app/admin/tenants/page.tsx`

- [ ] **Step 1: Create the tenant actions (server)**

Create `app/admin/tenants/_actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type LedgerEntry = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
  created_at: string;
};

export async function getTenantLedger(tenantId: string): Promise<LedgerEntry[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("credit_ledger")
    .select("id, delta, balance_after, reason, note, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<LedgerEntry[]>();
  return data ?? [];
}

export async function adjustCredit(
  tenantId: string,
  delta: number,
  note: string,
): Promise<{ error?: string }> {
  if (!Number.isInteger(delta) || delta === 0)
    return { error: "จำนวนต้องเป็นจำนวนเต็มที่ไม่ใช่ 0" };
  if (!note.trim()) return { error: "กรุณากรอกเหตุผล" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("adjust_credit", {
    p_tenant_id: tenantId,
    p_delta: delta,
    p_note: note.trim(),
    p_actor: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  return {};
}
```

- [ ] **Step 2: Create the tenants table (client)**

Create `app/admin/tenants/_tenants-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TenantDrawer } from "./_tenant-drawer";

export type TenantRow = {
  id: string;
  name: string;
  plan: string;
  credit_balance: number;
  created_at: string;
};

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const [selected, setSelected] = useState<TenantRow | null>(null);

  if (tenants.length === 0) {
    return <p className="text-sm text-zinc-500">ยังไม่มี tenant</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tenants.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelected(t)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </td>
                <td className="px-4 py-3 text-zinc-500">{t.plan}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ฿{t.credit_balance.toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                  {new Date(t.created_at).toLocaleDateString("th-TH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TenantDrawer tenant={selected} onClose={() => setSelected(null)} />
    </>
  );
}
```

- [ ] **Step 3: Create the tenant drawer (client)**

Create `app/admin/tenants/_tenant-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { adjustCredit, getTenantLedger, type LedgerEntry } from "./_actions";
import { type TenantRow } from "./_tenants-table";

const REASON_LABEL: Record<string, string> = {
  topup_slip: "เติมเงิน",
  activate_event: "เปิดงาน",
  refund: "คืนเครดิต",
  adjustment: "ปรับยอด",
};

export function TenantDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantRow | null;
  onClose: () => void;
}) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount("");
    setNote("");
    setError(null);
    setLedger([]);
    if (tenant) getTenantLedger(tenant.id).then(setLedger);
  }, [tenant?.id]);

  const delta = parseInt(amount, 10);
  const canSubmit = Number.isInteger(delta) && delta !== 0 && note.trim().length > 0;

  return (
    <Drawer open={tenant !== null} onClose={onClose} title="Tenant detail">
      {tenant && (
        <div className="space-y-6">
          <div>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {tenant.name}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Balance:{" "}
              <span className="font-medium tabular-nums">
                ฿{tenant.credit_balance.toLocaleString()}
              </span>{" "}
              · {tenant.plan}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ปรับเครดิต (Adjustment)
            </p>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="+100 หรือ -50"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เหตุผล (บันทึกใน ledger)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <ConfirmButton
              confirmLabel="ยืนยันปรับยอด"
              pendingLabel="กำลังบันทึก…"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              onConfirm={async () => {
                setError(null);
                const r = await adjustCredit(tenant.id, delta, note);
                if (r.error) setError(r.error);
                else onClose();
              }}
            >
              ปรับยอด
            </ConfirmButton>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ประวัติเครดิตล่าสุด
            </p>
            {ledger.length === 0 ? (
              <p className="text-xs text-zinc-400">ยังไม่มีรายการ</p>
            ) : (
              <ul className="space-y-1.5">
                {ledger.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between border-b border-zinc-100 pb-1.5 text-xs dark:border-zinc-800"
                  >
                    <span className="text-zinc-500">
                      {REASON_LABEL[e.reason] ?? e.reason}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        e.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {e.delta >= 0 ? "+" : ""}
                      {e.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 4: Create the tenants page (server)**

Create `app/admin/tenants/page.tsx`:

```tsx
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { TenantsTable, type TenantRow } from "./_tenants-table";

export default async function AdminTenantsPage() {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, plan, credit_balance, created_at")
    .order("created_at", { ascending: false })
    .returns<TenantRow[]>();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Tenants
      </h1>
      <TenantsTable tenants={data ?? []} />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verify**

Run: `npm run dev` → `/admin/tenants`.
Expected: tenants table; click a row → drawer shows balance + recent ledger. Enter `+100`, a note, click **ปรับยอด** → "แน่ใจ?" → confirm → drawer closes, balance increases by 100. Try a large negative that exceeds the balance → expect the `insufficient_balance` error shown inline. Confirm a new `adjustment` ledger row exists with `actor_user_id` = your user id.

- [ ] **Step 7: Commit**

```bash
git add app/admin/tenants/
git commit -m "feat(admin): tenant management table + drawer + attributable credit adjustment"
```

---

## Self-Review (spec coverage)

| #19 acceptance criterion | Covered by |
|---|---|
| Admin auth + RLS-bypass reads | Task 1 (env allowlist) + ADR 0001; service-role reads throughout |
| Pending slip list, sort by uploaded_at | Task 5 (pending-first sort) |
| Row shows tenant, package, amount, credits, uploaded_at | Task 5 table + drawer |
| Click row → enlarge slip image + tenant + payment details | Task 5 drawer (image + dl) |
| Approve → atomic (slip + ledger + balance) | Task 2 RPC + Task 5 |
| Reject + reason → status rejected | Task 2 RPC + Task 5 |
| Audit log: who verified, when | Task 2 (`verified_by`, `actor_user_id`) + Task 5 wiring |
| All-slips history + filter status | Task 5 (200 rows, status badges; full filter UI = follow-up) |
| Mini dashboard: pending count, credits out | Task 4 (4 stat cards) |
| Tenant management (Q1) + adjust credit (Q2) | Task 6 |

**Gaps intentionally deferred:** rich status/date filtering on slip history (basic sort only), and "today's approved/rejected / credits this month" time-windowed metrics (the 4 cards are the agreed "essential set", Q7). Add later if needed.

---

## Follow-up: Plan 2 — Person-first identity & tenant profile/billing

A separate plan (its own file) because it touches signup, guest-facing display, and ~6 `tenant.name` read sites — a different subsystem from the admin console. Scope captured here so it isn't lost:

1. **Migration:** add `tenants.first_name, last_name, organization_name (nullable), phone, billing_address, tax_id, avatar_url`; backfill `first_name`/`organization_name` from the existing `name`; keep `name` until all readers move to the helper.
2. **`tenantDisplayName(tenant)` helper + unit test** — `organization_name || "${first_name} ${last_name}".trim() || name`. (Person-first identity, org-name display priority — see `CONTEXT.md` "Display name".)
3. **Update display sites** to use the helper: `lib/auth/current-tenant.ts` (extend select), `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/api/topup/upload-slip/route.ts`, admin slips/tenants tables.
4. **Organizer self-service** — expand `app/dashboard/account/_profile-section.tsx` + `lib/actions/account.ts` to edit the new profile/billing fields (the **who-enters** decision: organizer edits their own; admin tenant detail stays read-only + credit-adjust).
5. **Guest photographer credit** — show `tenantDisplayName` on `app/e/[token]` as the photographer credit (new display site).
6. **Enrich the admin tenant drawer** (Task 6) with the new profile/billing fields.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-29-admin-dashboard.md`.

Three options:

1. **Write Plan 2 first** — flesh out the person-first identity plan (above) before any coding, so the whole picture is locked.
2. **Subagent-Driven execution (recommended)** — I dispatch a fresh subagent per task (1→6), reviewing between tasks. Uses `superpowers:subagent-driven-development`.
3. **Inline execution** — I run the tasks in this session with checkpoints. Uses `superpowers:executing-plans`.

Which would you like?

# People Sidebar Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right sidebar to the event gallery listing the named people confirmed in this event, where clicking a name filters the grid to that person's photos — reusing the existing person-filter pipeline (no new AI calls, no schema).

**Architecture:** Event page queries `photo_people ⋈ people` (confirmed, this event) once and groups it into `eventPeople` + `photoIdsByPerson`, passed to `PhotoGallery`. The gallery's existing `#22` face-pick filter (`personFilter: FilterPayload`) is generalized into one `activeFilter` that both the face-pick AND the sidebar set; a new `_people-sidebar.tsx` renders the list (vertical aside on desktop, horizontal chip row on mobile) and is hidden when no one is named.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase user client (RLS), Vitest.

**Spec:** [docs/superpowers/specs/2026-06-11-people-sidebar-filter-design.md](../specs/2026-06-11-people-sidebar-filter-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/people/queries.ts` | Modify | `groupEventPeople` (pure) + `getEventPeople(eventId)` |
| `__tests__/people/event-people.test.ts` | Create | Unit tests for `groupEventPeople` |
| `app/dashboard/events/[id]/_photo-gallery.tsx` | Modify | `personFilter` → unified `activeFilter`; sidebar + layout; props |
| `app/dashboard/events/[id]/_people-sidebar.tsx` | Create | People list (vertical aside + horizontal chips) |
| `app/dashboard/events/[id]/page.tsx` | Modify | Call `getEventPeople` + pass props |

No migration.

---

## Task 1: `groupEventPeople` + `getEventPeople`

**Files:**
- Modify: `lib/people/queries.ts`
- Create: `__tests__/people/event-people.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/people/event-people.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupEventPeople } from "@/lib/people/queries";

describe("groupEventPeople", () => {
  it("groups photo ids per person and counts them", () => {
    const { people, photoIdsByPerson } = groupEventPeople([
      { personId: "p1", name: "พี่หนึ่ง", photoId: "a" },
      { personId: "p1", name: "พี่หนึ่ง", photoId: "b" },
      { personId: "p2", name: "น้องแพร", photoId: "a" },
    ]);
    expect(photoIdsByPerson).toEqual({ p1: ["a", "b"], p2: ["a"] });
    expect(people).toEqual([
      { id: "p1", name: "พี่หนึ่ง", count: 2 },
      { id: "p2", name: "น้องแพร", count: 1 },
    ]);
  });

  it("sorts by count desc, then name asc on ties", () => {
    const { people } = groupEventPeople([
      { personId: "b", name: "Bee", photoId: "1" },
      { personId: "a", name: "Ann", photoId: "2" },
    ]);
    expect(people.map((p) => p.id)).toEqual(["a", "b"]); // tie on count=1 → name asc
  });

  it("returns empty structures for no rows", () => {
    expect(groupEventPeople([])).toEqual({ people: [], photoIdsByPerson: {} });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run __tests__/people/event-people.test.ts`
Expected: FAIL — `groupEventPeople` is not exported.

- [ ] **Step 3: Add `groupEventPeople` + `getEventPeople` to `lib/people/queries.ts`**

Append at the end of the file:

```ts
export type EventPerson = { id: string; name: string; count: number };
export type EventPeopleResult = {
  people: EventPerson[];
  photoIdsByPerson: Record<string, string[]>;
};

/** Group flat (person × photo) rows into a sorted people list + photo-id map. Pure. */
export function groupEventPeople(
  rows: { personId: string; name: string; photoId: string }[],
): EventPeopleResult {
  const photoIdsByPerson: Record<string, string[]> = {};
  const nameById: Record<string, string> = {};
  for (const r of rows) {
    (photoIdsByPerson[r.personId] ??= []).push(r.photoId);
    nameById[r.personId] = r.name;
  }
  const people = Object.keys(photoIdsByPerson)
    .map((id) => ({ id, name: nameById[id], count: photoIdsByPerson[id].length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { people, photoIdsByPerson };
}

/** Confirmed named people in an event, with per-person photo ids (RLS-scoped). */
export async function getEventPeople(eventId: string): Promise<EventPeopleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photo_people")
    .select("person_id, photo_id, people!inner(name)")
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  if (error) throw error;

  const flat = (data ?? []).map((r) => ({
    personId: r.person_id,
    photoId: r.photo_id,
    name: (r.people as unknown as { name: string }).name,
  }));
  return groupEventPeople(flat);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run __tests__/people/event-people.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/people/queries.ts __tests__/people/event-people.test.ts
git commit -m "feat(people): getEventPeople + groupEventPeople for the event sidebar"
```

---

## Task 2: Unify the gallery person filter (`personFilter` → `activeFilter`)

Pure refactor — `#22` face-pick keeps working, no sidebar yet. Generalizes the filter so the sidebar (Task 3) can feed it.

**Files:**
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Replace the `personFilter` state with `activeFilter` + `applyFaceFilter`**

Find (around line 80):

```ts
  // Person filter: narrow the gallery to one person's photos (issue #22)
  const [personFilter, setPersonFilter] = useState<FilterPayload | null>(null);
```

Replace with:

```ts
  // Unified person filter: set by the ⋮ face-pick (#22) OR the people sidebar.
  // `face` is present only for the face-pick → chip shows a cropped thumbnail.
  const [activeFilter, setActiveFilter] = useState<ActivePersonFilter | null>(null);
  const applyFaceFilter = (payload: FilterPayload) => {
    setActiveFilter({
      key: payload.faceId,
      label: "ใบหน้าที่เลือก",
      photoIds: payload.photoIds,
      face: { sourceUrl: payload.sourceUrl, bbox: payload.bbox },
    });
  };
```

- [ ] **Step 2: Add the `ActivePersonFilter` type**

Just above the `type Props = {` block (around line 60), add:

```ts
type ActivePersonFilter = {
  key: string; // faceId (face-pick) or personId (sidebar) — used as the reset key
  label: string;
  photoIds: Set<string>;
  face?: { sourceUrl: string | null; bbox: { left: number; top: number; width: number; height: number } };
};
```

- [ ] **Step 3: Update `visible` and `tabFilterKey` to read `activeFilter`**

Find:

```ts
    .filter((p) => !personFilter || personFilter.photoIds.has(p.id));
```

Replace with:

```ts
    .filter((p) => !activeFilter || activeFilter.photoIds.has(p.id));
```

Find:

```ts
  const tabFilterKey = `${tab}|${faceFilter}|${personFilter?.faceId ?? ""}|${flat ? "flat" : path}`;
```

Replace with:

```ts
  const tabFilterKey = `${tab}|${faceFilter}|${activeFilter?.key ?? ""}|${flat ? "flat" : path}`;
```

- [ ] **Step 4: Rewrite the chip to branch on `activeFilter.face`**

Replace the whole chip block (the `{personFilter && ( … )}` JSX, around lines 319–349) with:

```tsx
      {/* ── Active person filter chip (face-pick #22 or sidebar) ────────────── */}
      {activeFilter && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-[rgba(212,175,55,0.3)]">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
            {activeFilter.face ? (
              activeFilter.face.sourceUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeFilter.face.sourceUrl}
                  alt=""
                  className="absolute max-w-none"
                  style={{
                    width: `${(1 / activeFilter.face.bbox.width) * 28}px`,
                    left: `${-(activeFilter.face.bbox.left / activeFilter.face.bbox.width) * 28}px`,
                    top: `${-(activeFilter.face.bbox.top / activeFilter.face.bbox.width) * 28}px`,
                  }}
                />
              )
            ) : (
              <span>{activeFilter.label.charAt(0)}</span>
            )}
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {activeFilter.label} · เจอ {visible.length} รูป
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="ล้างตัวกรองบุคคล"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
```

- [ ] **Step 5: Point the face-pick call sites at `applyFaceFilter`**

There are two `onApplyPersonFilter={setPersonFilter}` usages (the grid and list render calls, around lines 446 and 464). Replace both:

```tsx
              onApplyPersonFilter={applyFaceFilter}
```

(The threaded prop type `onApplyPersonFilter: (payload: FilterPayload) => void` on `GridCard`/`ListRow`/`PhotoMenu`, and the `mode="filter"` portal that calls `onApplyPersonFilter(payload)`, all stay unchanged — they still emit a `FilterPayload`, now consumed by `applyFaceFilter`.)

- [ ] **Step 6: Typecheck + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors; all tests pass (the refactor is behavior-preserving for #22).

- [ ] **Step 7: Commit**

```bash
git add "app/dashboard/events/[id]/_photo-gallery.tsx"
git commit -m "refactor(gallery): unify person filter (face-pick + future sidebar) into activeFilter"
```

---

## Task 3: People sidebar component + wiring

**Files:**
- Create: `app/dashboard/events/[id]/_people-sidebar.tsx`
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`
- Modify: `app/dashboard/events/[id]/page.tsx`

- [ ] **Step 1: Create `_people-sidebar.tsx`**

```tsx
"use client";

import type { EventPerson } from "@/lib/people/queries";

type Props = {
  people: EventPerson[];
  activeId: string | null;
  onSelect: (personId: string | null) => void;
  layout: "vertical" | "horizontal";
};

// People in this event (named, confirmed). Click a name to filter the grid;
// click the active one (or "ทั้งหมด") to clear. Vertical = desktop aside,
// horizontal = mobile chip row.
export function PeopleSidebar({ people, activeId, onSelect, layout }: Props) {
  if (people.length === 0) return null;

  if (layout === "horizontal") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip active={activeId === null} onClick={() => onSelect(null)} label="ทั้งหมด" />
        {people.map((p) => (
          <Chip
            key={p.id}
            active={activeId === p.id}
            onClick={() => onSelect(activeId === p.id ? null : p.id)}
            label={`${p.name} ${p.count}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
        บุคคลในงานนี้
      </p>
      <Row active={activeId === null} onClick={() => onSelect(null)} name="ทั้งหมด" />
      {people.map((p) => (
        <Row
          key={p.id}
          active={activeId === p.id}
          onClick={() => onSelect(activeId === p.id ? null : p.id)}
          name={p.name}
          count={p.count}
        />
      ))}
    </div>
  );
}

function Row({
  active,
  onClick,
  name,
  count,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        active
          ? "bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
      ].join(" ")}
    >
      {count !== undefined && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
          {name.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{name}</span>
      {count !== undefined && (
        <span className={`text-xs tabular-nums ${active ? "text-[#D4AF37] font-bold" : "text-zinc-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[#D4AF37] text-black"
          : "border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-[#D4AF37]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Add props to `PhotoGallery` and a `selectPerson` handler**

In `_photo-gallery.tsx`, import the type and the component at the top (next to the other local imports):

```ts
import { PeopleSidebar } from "./_people-sidebar";
import type { EventPerson } from "@/lib/people/queries";
```

Extend `Props`:

```ts
type Props = {
  eventId: string;
  eventName: string;
  photos: GalleryPhoto[];
  eventPeople: EventPerson[];
  photoIdsByPerson: Record<string, string[]>;
};

export function PhotoGallery({ eventId, eventName, photos, eventPeople, photoIdsByPerson }: Props) {
```

Add `selectPerson` next to `applyFaceFilter` (from Task 2):

```ts
  const selectPerson = (personId: string | null) => {
    if (!personId) return setActiveFilter(null);
    const person = eventPeople.find((p) => p.id === personId);
    if (!person) return;
    setActiveFilter({
      key: personId,
      label: person.name,
      photoIds: new Set(photoIdsByPerson[personId] ?? []),
    });
  };
  // The sidebar highlights a row only for a person-filter (not a face-pick).
  const sidebarActiveId = activeFilter && !activeFilter.face ? activeFilter.key : null;
```

- [ ] **Step 3: Wrap the return in a 2-column layout + render the sidebar**

Find the opening of the return (around line 206):

```tsx
  return (
    <div className="space-y-3">
```

Replace with:

```tsx
  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <div className="space-y-3 lg:min-w-0 lg:flex-1">
```

Find the matching close of that div — the `</div>` immediately after the Lightbox block (around line 487):

```tsx
        />
      )}
    </div>
  );
}
```

Replace with (closes the content column, adds the desktop aside, closes the flex wrapper):

```tsx
        />
      )}
      </div>

      {eventPeople.length > 0 && (
        <aside className="hidden shrink-0 lg:sticky lg:top-4 lg:block lg:w-60">
          <PeopleSidebar
            people={eventPeople}
            activeId={sidebarActiveId}
            onSelect={selectPerson}
            layout="vertical"
          />
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the mobile chip row inside the content column**

Find the top-bar closing + face-count filter — insert the mobile people row right after the top-bar `</div>` (around line 218, before the `{/* ── Face count filter`):

```tsx
      {/* Mobile: people as a horizontal chip row (desktop uses the aside) */}
      {eventPeople.length > 0 && (
        <div className="lg:hidden">
          <PeopleSidebar
            people={eventPeople}
            activeId={sidebarActiveId}
            onSelect={selectPerson}
            layout="horizontal"
          />
        </div>
      )}
```

- [ ] **Step 5: Pass the data from the event page**

In `app/dashboard/events/[id]/page.tsx`, add the import:

```ts
import { getEventPeople } from "@/lib/people/queries";
```

After `photoList` is built (around line 70, before `const hasPhotos`), fetch the people:

```ts
  const { people: eventPeople, photoIdsByPerson } = await getEventPeople(id);
```

Update the `<PhotoGallery .../>` call (around line 133):

```tsx
        <PhotoGallery
          eventId={event.id}
          eventName={event.name}
          photos={photoList}
          eventPeople={eventPeople}
          photoIdsByPerson={photoIdsByPerson}
        />
```

- [ ] **Step 6: Typecheck + lint + tests + build**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors; all tests pass.

Run: `npm run build`
Expected: build succeeds; `/dashboard/events/[id]` listed.

- [ ] **Step 7: Commit**

```bash
git add "app/dashboard/events/[id]/_people-sidebar.tsx" "app/dashboard/events/[id]/_photo-gallery.tsx" "app/dashboard/events/[id]/page.tsx"
git commit -m "feat(gallery): people sidebar — click a name to filter the event grid"
```

---

## Task 4: Verify in app

- [ ] **Step 1** `npm run dev` → open a business event that has enrolled + scanned people → the right sidebar lists names with counts, newest-largest first; "ทั้งหมด" at top.
- [ ] **Step 2** Click a name → grid narrows to that person's photos; chip shows `{name} · เจอ N รูป`; the row is highlighted gold.
- [ ] **Step 3** Click the active name again, or "ทั้งหมด", or the chip ✕ → filter clears.
- [ ] **Step 4** Compose: drill into a subfolder / switch tab / change face-count filter while a person is selected → results stay correctly intersected.
- [ ] **Step 5** Use the ⋮ → "ดูเฉพาะรูปของคนนี้" face-pick (#22) → still works, shares the same chip; the sidebar is NOT highlighted (face-pick has no person id).
- [ ] **Step 6** Open an event with no named people (or a free-tier tenant) → no sidebar, no mobile chip row, page unchanged.
- [ ] **Step 7** Narrow the viewport (< lg) → the sidebar becomes a horizontal chip row above the grid; tapping filters the same way.

---

## Self-Review

**Spec coverage:** sidebar of named people + counts → Task 1 (data) + Task 3 (UI). Click-to-filter via existing pipeline → Task 2 (unified `activeFilter`) + Task 3 (`selectPerson`). Single-select + clear → `selectPerson` toggles to null. Unify with #22 → Task 2. Hidden when empty → `PeopleSidebar` early-returns null + `eventPeople.length > 0` guards. Mobile chip row → Task 3 Step 4. Confirmed-only → `getEventPeople` filters `status='confirmed'`.

**Placeholders:** none — full code in every step.

**Type consistency:** `EventPerson`/`EventPeopleResult` defined in Task 1, consumed in Tasks 2-3 ✓ · `ActivePersonFilter` defined Task 2 Step 2, used Steps 1/3/4 + Task 3 (`sidebarActiveId`, `selectPerson`) ✓ · `applyFaceFilter(payload: FilterPayload)` matches the unchanged `onApplyPersonFilter` prop type ✓ · `getEventPeople(id)` returns `{ people, photoIdsByPerson }` destructured in the event page ✓ · `PeopleSidebar` props (`people/activeId/onSelect/layout`) match both call sites ✓.

**Note:** `getEventPeople` runs serially after the `Promise.all` block (one extra small query) — acceptable for a dashboard page; could be folded into the `Promise.all` later if latency matters.

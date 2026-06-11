# Gallery Face Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "ดูเฉพาะรูปของคนนี้" to the event gallery — organizer picks a face from any photo and the gallery narrows to photos containing that person within the event.

**Architecture:** 2-file change only. `_person-ban-modal.tsx` gains `mode="filter"` + `onApplyFilter` callback that short-circuits before stage 2. `_photo-gallery.tsx` gains a `personFilter` state layer that intersects with the existing tab + face-count filters, plus a chip UI and prop drilling down to `PhotoMenu`. No migration, no new actions.

**Tech Stack:** React 19, TypeScript, existing `findMatchingFacesByFaceId` (lib/actions/blacklist.ts), `PersonPickerModal` (`_person-ban-modal.tsx`), heroicons

**Issues:** [#22](../../../ISSUES.md)
**Spec:** [docs/superpowers/specs/2026-06-04-gallery-face-filter-design.md](../specs/2026-06-04-gallery-face-filter-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/dashboard/events/[id]/_person-ban-modal.tsx` | Modify | Add `mode="filter"`, export `FilterPayload` type, `onApplyFilter` callback |
| `app/dashboard/events/[id]/_photo-gallery.tsx` | Modify | `personFilter` state, filter layer, chip UI, prop drill, menu item |

---

## Task 1: Add mode="filter" to PersonPickerModal

**Files:**
- Modify: `app/dashboard/events/[id]/_person-ban-modal.tsx`

- [ ] **Step 1: Export `FilterPayload` type and extend `Mode`**

Replace the top of the file (lines 8–13):

```ts
export type FilterPayload = {
  faceId: string;
  sourcePhotoId: string;
  bbox: { left: number; top: number; width: number; height: number };
  sourceUrl: string | null;
  photoIds: Set<string>;
};

type Mode = "hide" | "unhide" | "filter";
```

- [ ] **Step 2: Add `id` to the photo prop type and add `onApplyFilter` to `PersonPickerModal` props**

Change the props interface (lines 19–28):

```ts
export function PersonPickerModal({
  eventId,
  photo,
  mode,
  onClose,
  onApplyFilter,
}: {
  eventId: string;
  photo: { id: string; r2_web_url: string | null; face_details: FaceDetail[] };
  mode: Mode;
  onClose: () => void;
  onApplyFilter?: (payload: FilterPayload) => void;
}) {
```

- [ ] **Step 3: Modify `pickFace` to accept the full `FaceDetail` and branch on `mode="filter"`**

Replace `pickFace` (lines 34–40):

```ts
const pickFace = (face: FaceDetail) => {
  setActiveFaceId(face.face_id);
  startSearch(async () => {
    const result = await findMatchingFacesByFaceId(eventId, face.face_id);
    if (mode === "filter") {
      onApplyFilter?.({
        faceId: face.face_id,
        sourcePhotoId: photo.id,
        bbox: face.bbox,
        sourceUrl: photo.r2_web_url,
        photoIds: new Set(result.map((r) => r.photoId)),
      });
      onClose();
      return;
    }
    setPreviews(result);
  });
};
```

- [ ] **Step 4: Update button `onClick` in the face picker (lines 100–101) to pass the full face object**

```tsx
onClick={() => pickFace(face)}
```

- [ ] **Step 5: Update footer hint text to be mode-aware (around line 127)**

```tsx
<p className="text-xs text-zinc-500">
  {mode === "filter" ? "คลิกใบหน้าเพื่อกรองรูป" : "คลิกใบหน้าเพื่อดูรูปของคนนั้น"}
</p>
```

- [ ] **Step 6: Run lint — expect 0 errors**

```bash
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/events/\[id\]/_person-ban-modal.tsx
git commit -m "feat(gallery): add mode=filter + FilterPayload to PersonPickerModal"
```

---

## Task 2: Add personFilter state + filter layer to PhotoGallery

**Files:**
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Import `FilterPayload` and `MagnifyingGlassIcon`**

Add to existing imports at top of file:

```ts
import { PersonPickerModal, type FilterPayload } from "./_person-ban-modal";
```

```ts
import {
  // ...existing icons...
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
```

- [ ] **Step 2: Add `PersonFilter` type and state inside `PhotoGallery`**

After the existing `useState` declarations (after line 67):

```ts
type PersonFilter = FilterPayload | null;
const [personFilter, setPersonFilter] = useState<PersonFilter>(null);
```

- [ ] **Step 3: Add `personFilter` to `visible` derivation**

Replace the `visible` block (lines 75–83):

```ts
const visible = tabPhotos
  .filter((p) => {
    if (faceFilter === "all") return true;
    const n = p.face_details.length;
    if (faceFilter === "0") return n === 0;
    if (faceFilter === "1") return n === 1;
    if (faceFilter === "2") return n === 2;
    if (faceFilter === "3+") return n >= 3;
    return true;
  })
  .filter((p) => !personFilter || personFilter.photoIds.has(p.id));
```

- [ ] **Step 4: Extend `tabFilterKey` to reset lightbox/selection when personFilter changes**

Replace line 87:

```ts
const tabFilterKey = `${tab}|${faceFilter}|${personFilter?.faceId ?? ""}`;
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/events/\[id\]/_photo-gallery.tsx
git commit -m "feat(gallery): personFilter state + visible filter layer"
```

---

## Task 3: Prop drill + menu item

**Files:**
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Add `onApplyPersonFilter` prop to `GridCard` and drill it to `PhotoMenu`**

Find `GridCard` function signature (around line 347) and add the prop:

```ts
function GridCard({
  photo,
  eventId,
  onApplyPersonFilter,
  selectMode,
  selected,
  onToggleSelect,
  onViewPhoto,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onViewPhoto: () => void;
}) {
```

Pass it through to `PhotoMenu` in the return JSX (around line 426):

```tsx
<PhotoMenu photo={photo} eventId={eventId} onApplyPersonFilter={onApplyPersonFilter} />
```

- [ ] **Step 2: Do the same for `ListRow`**

Find `ListRow` function signature (around line 435) and add:

```ts
function ListRow({
  photo,
  eventId,
  onApplyPersonFilter,
  selectMode,
  selected,
  onToggleSelect,
  onViewPhoto,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
  // ...rest unchanged
}) {
```

Pass it through to the `PhotoMenu` inside `ListRow`.

- [ ] **Step 3: Thread `onApplyPersonFilter={setPersonFilter}` from the `PhotoGallery` render calls to `GridCard` and `ListRow`**

In the grid render (around line 291):

```tsx
{visible.map((photo, idx) => (
  <GridCard
    key={photo.id}
    photo={photo}
    eventId={eventId}
    onApplyPersonFilter={setPersonFilter}
    selectMode={selectMode}
    selected={selectedIds.has(photo.id)}
    onToggleSelect={toggleSelect}
    onViewPhoto={() => setActivePhotoIdx(idx)}
  />
))}
```

And in the list render (around line 308) — same pattern for `ListRow`.

- [ ] **Step 4: Update `PhotoMenu` to accept and use `onApplyPersonFilter`**

Find `PhotoMenu` (around line 581):

```ts
function PhotoMenu({
  photo,
  eventId,
  onApplyPersonFilter,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);  // NEW
  // ...rest unchanged
```

- [ ] **Step 5: Add the "ดูเฉพาะรูปของคนนี้" menu item in `PhotoMenu`**

Add after the existing "ซ่อนบุคคล" block (after line 660), still inside the `photo.face_details.length > 0` guard:

```tsx
{photo.face_details.length > 0 && (
  <>
    <MenuItem
      onClick={() => { setOpen(false); setPickerOpen(true); }}
      icon={isHidden ? EyeIcon : EyeSlashIcon}
    >
      {isHidden ? "แสดงบุคคล" : "ซ่อนบุคคล"}
    </MenuItem>
    <MenuItem
      onClick={() => { setOpen(false); setFilterPickerOpen(true); }}
      icon={MagnifyingGlassIcon}
    >
      ดูเฉพาะรูปของคนนี้
    </MenuItem>
  </>
)}
```

- [ ] **Step 6: Add portal for the filter picker in `PhotoMenu`**

Add after the existing `pickerOpen` portal (around line 672):

```tsx
{filterPickerOpen &&
  typeof document !== "undefined" &&
  createPortal(
    <PersonPickerModal
      eventId={eventId}
      photo={photo}
      mode="filter"
      onClose={() => setFilterPickerOpen(false)}
      onApplyFilter={(payload) => {
        onApplyPersonFilter(payload);
        setFilterPickerOpen(false);
      }}
    />,
    document.body,
  )}
```

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/events/\[id\]/_photo-gallery.tsx
git commit -m "feat(gallery): drill onApplyPersonFilter + add menu item 'ดูเฉพาะรูปของคนนี้'"
```

---

## Task 4: Active filter chip UI

**Files:**
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Add the chip block in `PhotoGallery` JSX, between the filter row and the grid**

Find where the filter controls end and the grid begins (around line 284 — the `EmptyState` / grid block). Insert the chip immediately above that section:

```tsx
{/* Active person filter chip */}
{personFilter && (
  <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
    {/* Face thumbnail — crop the ref face from its source photo using bbox */}
    <div className="relative overflow-hidden rounded-full w-7 h-7 shrink-0 bg-zinc-300 dark:bg-zinc-700">
      {personFilter.sourceUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={personFilter.sourceUrl}
          alt=""
          className="absolute max-w-none"
          style={{
            width: `${(1 / personFilter.bbox.width) * 28}px`,
            top: `-${(personFilter.bbox.top / personFilter.bbox.width) * 28}px`,
            left: `-${(personFilter.bbox.left / personFilter.bbox.width) * 28}px`,
          }}
        />
      )}
    </div>
    <span className="text-xs text-zinc-600 dark:text-zinc-400">
      กรองตามใบหน้า · เจอ {visible.length} รูป
    </span>
    <button
      type="button"
      onClick={() => setPersonFilter(null)}
      className="ml-auto flex items-center justify-center w-5 h-5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      aria-label="ล้างตัวกรองใบหน้า"
    >
      <XMarkIcon className="w-3.5 h-3.5" />
    </button>
  </div>
)}
```

- [ ] **Step 2: Update the EmptyState to hint when personFilter is active**

Find the `visible.length === 0` EmptyState (around line 284):

```tsx
{visible.length === 0 && (
  <EmptyState
    title={personFilter ? "ไม่พบรูปในแท็บนี้" : "ยังไม่มีรูปในส่วนนี้"}
    description={
      personFilter
        ? "บุคคลนี้อาจไม่มีรูปในแท็บที่เลือก — ลองสลับแท็บ หรือกด ✕ เพื่อล้างตัวกรอง"
        : undefined
    }
  />
)}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/events/\[id\]/_photo-gallery.tsx
git commit -m "feat(gallery): active person filter chip with face thumbnail + count"
```

---

## Task 5: Verify in app

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Docker Desktop must be running first.

- [ ] **Step 2: Open an event that has synced photos with face detection**

Navigate to `http://localhost:3000/dashboard` → open any event with indexed photos.

- [ ] **Step 3: Golden path — filter by face**

1. Open ⋮ menu on a photo that has at least 1 face (`face_details.length > 0`) → "ดูเฉพาะรูปของคนนี้" item is visible
2. Click it → `PersonPickerModal` opens with face bounding boxes
3. Click a face → picker closes → gallery narrows → chip appears above grid showing face thumbnail + "เจอ N รูป"
4. Verify all visible cards contain that person

- [ ] **Step 4: Compose with tab and face count filter**

1. With personFilter active, switch tab (ทั้งหมด ↔ ไม่เผยแพร่) → filter persists, count changes correctly
2. With personFilter active, change face count filter → intersection applied correctly

- [ ] **Step 5: Clear filter**

Click ✕ on chip → gallery returns to full view, chip disappears, lightbox resets

- [ ] **Step 6: Empty-state case**

Apply personFilter while on "ไม่เผยแพร่" tab where the person has no hidden photos → EmptyState shows with "บุคคลนี้อาจไม่มีรูปในแท็บที่เลือก" message

- [ ] **Step 7: Zero-face photo guard**

Open ⋮ menu on a photo with 0 faces → "ดูเฉพาะรูปของคนนี้" is NOT visible

- [ ] **Step 8: Local stub degrade (no Rekognition env)**

In local dev (no AWS env), pick a face → `findMatchingFacesByFaceId` returns stub `[]` → `photoIds` = `{sourcePhotoId}` only → gallery shows just that 1 source photo → chip says "เจอ 1 รูป" — expected

- [ ] **Step 9: Commit spec files that were untracked**

```bash
git add docs/superpowers/specs/ docs/superpowers/plans/ ISSUES.md
git commit -m "docs: add Gallery Face Filter + Person Archive specs, issues #22-#28, plans"
```

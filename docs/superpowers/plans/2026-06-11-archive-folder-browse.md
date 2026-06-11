# Archive Folder Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the synced archive browsable as a real file-explorer that mirrors the source Drive/Dropbox folder tree — open an event, see its subfolders, drill in via breadcrumb to the photos, with face search/filters layered on top.

**Architecture:** Sync learns to walk subfolders (recursive listing per provider) and records each photo's relative folder path in a single new `photos.folder_path` column. The event gallery derives a folder tree from those paths (no folders table) and renders a file-explorer: breadcrumb + subfolder tiles + photos-at-path, with the existing tab/face/person filters scoped to the current folder and a "view whole event" flat toggle.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), `googleapis` (Drive), Dropbox HTTP API, Vitest.

**Spec:** [docs/superpowers/specs/2026-06-11-archive-folder-browse-design.md](../specs/2026-06-11-archive-folder-browse-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/<ts>_add_folder_path_to_photos.sql` | Create | `photos.folder_path` column + index |
| `lib/supabase/types.ts` | Modify (generated) | Regenerated types incl. `folder_path` |
| `lib/storage/types.ts` | Modify | Add `relativePath` to `SourceFile` |
| `lib/dropbox-api.ts` | Modify | Recursive `list_folder`; `dropboxRelativePath` helper; `mapDropboxEntry` carries path |
| `lib/google-drive-api.ts` | Modify | `listImagesRecursive` folder walk |
| `lib/storage/dropbox-provider.ts` | Modify | Pass `relativePath` through |
| `lib/storage/google-drive-provider.ts` | Modify | Use recursive listing + map `relativePath` |
| `app/api/events/[id]/sync/route.ts` | Modify | Persist `folder_path` on insert + backfill existing rows |
| `lib/archive/folder-view.ts` | Create | `deriveFolderView` pure helper |
| `app/dashboard/events/[id]/page.tsx` | Modify | Select + map `folder_path` into `GalleryPhoto` |
| `app/dashboard/events/[id]/_photo-gallery.tsx` | Modify | File-explorer: path state, breadcrumb, subfolder tiles, scoped filters, flat toggle |
| `__tests__/storage/dropbox-relative-path.test.ts` | Create | Unit tests for `dropboxRelativePath` |
| `__tests__/archive/folder-view.test.ts` | Create | Unit tests for `deriveFolderView` |

---

## Task 1: Schema — `photos.folder_path`

**Files:**
- Create: `supabase/migrations/<timestamp>_add_folder_path_to_photos.sql`
- Modify: `lib/supabase/types.ts` (via `npm run db:types`)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260611120000_add_folder_path_to_photos.sql` (use a timestamp later than `20260611112549`):

```sql
-- Archive folder browse: relative subfolder path of each photo within its
-- connected source folder (e.g. 'พิธีเช้า/ช่วงเช้า'). '' = root of the folder.
-- The folder tree in the UI is derived from distinct prefixes of this column.
alter table public.photos
  add column folder_path text not null default '';

create index photos_event_folder_path_idx
  on public.photos (event_id, folder_path);
```

- [ ] **Step 2: Apply locally + regenerate types**

```bash
npm run db:reset
npm run db:types
```

Expected: no errors; `lib/supabase/types.ts` `photos` Row/Insert/Update now include `folder_path: string`.

- [ ] **Step 3: Verify the column exists**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d public.photos" | grep folder_path
```

Expected: `folder_path | text | not null | ''::text`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260611120000_add_folder_path_to_photos.sql lib/supabase/types.ts
git commit -m "feat(archive): add photos.folder_path for folder-tree browse"
```

- [ ] **Step 5: Apply to PROD (dogfood DB) via Supabase MCP**

Prod is dogfooded live, so apply the same DDL to prod (additive, safe). Using the `mcp__supabase__apply_migration` tool (project-scoped MCP, requires `/mcp` OAuth — see memory `deployment-prod`):

```
name: add_folder_path_to_photos
query:
  alter table public.photos add column folder_path text not null default '';
  create index photos_event_folder_path_idx on public.photos (event_id, folder_path);
```

Then confirm with `mcp__supabase__list_tables` (verbose) that `photos.folder_path` exists on prod.

---

## Task 2: `SourceFile.relativePath` + Dropbox recursive listing

**Files:**
- Modify: `lib/storage/types.ts`
- Modify: `lib/dropbox-api.ts`
- Modify: `lib/storage/dropbox-provider.ts`
- Create: `__tests__/storage/dropbox-relative-path.test.ts`

- [ ] **Step 1: Add `relativePath` to `SourceFile`**

In `lib/storage/types.ts`, extend the `SourceFile` type (after `modifiedTime`):

```ts
export type SourceFile = {
  /** Stable id used for dedup across syncs. Drive: file id. Dropbox: "id:..." */
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  /** ISO timestamp; best-available "taken/modified" hint, used as taken_at fallback. */
  modifiedTime?: string;
  /** Subfolder path relative to the connected folder root (e.g. 'a/b'). '' = root. */
  relativePath?: string;
};
```

- [ ] **Step 2: Write the failing test for `dropboxRelativePath`**

Create `__tests__/storage/dropbox-relative-path.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dropboxRelativePath } from "@/lib/dropbox-api";

describe("dropboxRelativePath", () => {
  it("returns '' for a file directly in the connected folder", () => {
    expect(dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/img.jpg")).toBe("");
  });

  it("returns the one-level subfolder", () => {
    expect(dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/พิธีเช้า/img.jpg")).toBe("พิธีเช้า");
  });

  it("returns nested subfolders joined with /", () => {
    expect(
      dropboxRelativePath("/สงกรานต์2024", "/สงกรานต์2024/พิธีเช้า/ช่วงเช้า/img.jpg"),
    ).toBe("พิธีเช้า/ช่วงเช้า");
  });

  it("matches the root case-insensitively but preserves child case", () => {
    expect(dropboxRelativePath("/Event", "/event/Morning/img.jpg")).toBe("Morning");
  });

  it("tolerates a trailing slash on the root", () => {
    expect(dropboxRelativePath("/Event/", "/Event/Sub/img.jpg")).toBe("Sub");
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run __tests__/storage/dropbox-relative-path.test.ts`
Expected: FAIL — `dropboxRelativePath` is not exported.

- [ ] **Step 4: Implement `dropboxRelativePath` + `path_display` on the entry type**

In `lib/dropbox-api.ts`, add `path_display` to `DropboxEntry`:

```ts
export type DropboxEntry = {
  ".tag": "file" | "folder" | "deleted";
  id: string;
  name: string;
  path_lower?: string;
  path_display?: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
};
```

Add the exported helper (place above `mapDropboxEntry`):

```ts
/**
 * Folder path of a Dropbox file relative to the connected root folder.
 * Strips the root prefix (case-insensitive — Dropbox lowercases path_lower)
 * and the filename, returning just the in-between directories joined with "/".
 * "" means the file sits directly in the connected folder.
 */
export function dropboxRelativePath(rootPath: string, filePath: string): string {
  const root = rootPath.replace(/\/+$/, "");
  const rel = filePath.toLowerCase().startsWith(root.toLowerCase())
    ? filePath.slice(root.length)
    : filePath;
  const trimmed = rel.replace(/^\/+/, "");
  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash === -1 ? "" : trimmed.slice(0, lastSlash);
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run __tests__/storage/dropbox-relative-path.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Make `dropboxListFolder` recursive and carry the path**

In `lib/dropbox-api.ts`, replace the `dropboxListFolder` body so it lists recursively and records each file's relative path. `mapDropboxEntry` gains an optional path argument:

```ts
/** Map a Dropbox file entry to the provider-agnostic SourceFile. */
export function mapDropboxEntry(e: DropboxEntry, relativePath = ""): SourceFile {
  return {
    id: e.id,
    name: e.name,
    mimeType: ext2mime(e.name),
    size: e.size,
    modifiedTime: e.client_modified ?? e.server_modified,
    relativePath,
  };
}

/** List image files in a folder AND all subfolders, following pagination. */
export async function dropboxListFolder(
  accessToken: string,
  path: string,
): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let res = await fetch(`${RPC_BASE}/files/list_folder`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, recursive: true, limit: 2000 }),
  });
  if (!res.ok) throw new Error(`Dropbox list_folder failed: ${res.status} ${await res.text()}`);
  let json = (await res.json()) as { entries: DropboxEntry[]; cursor: string; has_more: boolean };

  const collect = (entries: DropboxEntry[]) => {
    for (const e of entries) {
      if (e[".tag"] === "file" && IMAGE_EXT.test(e.name)) {
        const full = e.path_display ?? e.path_lower ?? `${path}/${e.name}`;
        out.push(mapDropboxEntry(e, dropboxRelativePath(path, full)));
      }
    }
  };
  collect(json.entries);

  while (json.has_more) {
    res = await fetch(`${RPC_BASE}/files/list_folder/continue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ cursor: json.cursor }),
    });
    if (!res.ok) throw new Error(`Dropbox list_folder/continue failed: ${res.status} ${await res.text()}`);
    json = (await res.json()) as { entries: DropboxEntry[]; cursor: string; has_more: boolean };
    collect(json.entries);
  }

  return out;
}
```

- [ ] **Step 7: Confirm the Dropbox provider passes `relativePath` through**

`lib/storage/dropbox-provider.ts` already returns whatever `dropboxListFolder` produces — no change needed (the `SourceFile`s now carry `relativePath`). Verify by reading `listImages` there; if it maps fields manually, ensure `relativePath` is preserved. (Current code returns the array directly, so it is.)

- [ ] **Step 8: Lint + commit**

```bash
npm run lint
git add lib/storage/types.ts lib/dropbox-api.ts __tests__/storage/dropbox-relative-path.test.ts
git commit -m "feat(archive): Dropbox recursive listing + relativePath capture"
```

---

## Task 3: Drive recursive listing

**Files:**
- Modify: `lib/google-drive-api.ts`
- Modify: `lib/storage/google-drive-provider.ts`

- [ ] **Step 1: Add `listImagesRecursive` to `google-drive-api.ts`**

After `listImagesInFolder` (it is reused per level), add:

```ts
/**
 * List image files in a Drive folder AND all nested subfolders, recording each
 * file's path relative to the starting folder (e.g. 'พิธีเช้า/ช่วงเช้า'). The
 * starting folder itself contributes relativePath ''. Reuses listImagesInFolder
 * per level; walks subfolders via the folder mimeType.
 */
export async function listImagesRecursive(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
  relativePath = "",
): Promise<Array<{ file: DriveFile; relativePath: string }>> {
  const out: Array<{ file: DriveFile; relativePath: string }> = [];

  // Images directly in this folder.
  const images = await listImagesInFolder(drive, folderId);
  for (const file of images) out.push({ file, relativePath });

  // Recurse into subfolders.
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 1000,
      pageToken,
    });
    for (const sub of res.data.files ?? []) {
      if (sub.id && sub.name) {
        const childPath = relativePath ? `${relativePath}/${sub.name}` : sub.name;
        out.push(...(await listImagesRecursive(drive, sub.id, childPath)));
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}
```

- [ ] **Step 2: Use it in the Drive provider, mapping `relativePath`**

In `lib/storage/google-drive-provider.ts`, update the import and `listImages`:

```ts
import {
  getDriveClient,
  listImagesRecursive,
  downloadDriveFile,
  isDriveRetryable,
  type DriveFile,
} from "@/lib/google-drive-api";
```

```ts
    async listImages(folderRef: string): Promise<SourceFile[]> {
      const entries = await withDriveRetry(() => listImagesRecursive(drive, folderRef));
      return entries.map(({ file, relativePath }) => ({ ...mapDriveFile(file), relativePath }));
    },
```

(`listImagesInFolder` is still imported transitively via `listImagesRecursive`; remove the now-unused direct import of `listImagesInFolder` from this provider if present — it is not imported here, so no change.)

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 0 errors. (No unit test here — the recursion is thin glue over the Drive SDK; covered by app verification in Task 7. The path-join logic mirrors the Dropbox helper already tested.)

- [ ] **Step 4: Commit**

```bash
git add lib/google-drive-api.ts lib/storage/google-drive-provider.ts
git commit -m "feat(archive): Drive recursive folder walk + relativePath"
```

---

## Task 4: Persist `folder_path` in sync + backfill existing rows

**Files:**
- Modify: `app/api/events/[id]/sync/route.ts`

- [ ] **Step 1: Select `folder_path` for existing photos**

In the sync route, the existing-photos query (around line 304) currently selects `id, storage_file_id, r2_web_url`. Add `folder_path`:

```ts
    const { data: existingPhotos } = await admin
      .from("photos")
      .select("id, storage_file_id, r2_web_url, folder_path")
      .eq("event_id", eventId);
```

- [ ] **Step 2: Build a path map and backfill mismatched paths in the done-skip branch**

Add a map of already-indexed file → {id, folder_path} alongside the existing `doneSet`/`needsUrlMap` (after the `needsUrlMap` definition, ~line 320):

```ts
    // file id → existing row, used to backfill folder_path on re-sync without
    // re-downloading (paths were '' before recursive listing existed).
    const existingById = new Map(
      (existingPhotos ?? []).map((p) => [p.storage_file_id, p]),
    );
```

Then, inside `handleFile`, replace the `doneSet.has(file.id)` early-return block (around line 340) so it backfills the path when it differs before skipping:

```ts
      if (doneSet.has(file.id)) {
        const existing = existingById.get(file.id);
        const newPath = file.relativePath ?? "";
        if (existing && existing.folder_path !== newPath) {
          await admin.from("photos").update({ folder_path: newPath }).eq("id", existing.id);
        }
        doneFolderCount++;
        send({
          type: "progress",
          folder: folderLabel,
          done: doneFolderCount,
          total: sourceFiles.length,
          skipped: true,
        });
        return;
      }
```

- [ ] **Step 3: Persist `folder_path` on the full-index insert**

In the photo insert (around line 647), add `folder_path`:

```ts
  await admin.from("photos").insert({
    id: photoId,
    event_id: eventId,
    storage_file_id: file.id,
    r2_web_url: webUrl,
    r2_full_url: fullUrl,
    rekognition_face_ids: faceIds,
    face_details: faceDetails,
    indexed_at: new Date().toISOString(),
    original_filename: file.name,
    taken_at: exif.takenAt || file.modifiedTime || new Date().toISOString(),
    photographer_name: exif.artist || null,
    copyright: exif.copyright || null,
    event_storage_folder_id: folderDbId,
    storage_bytes: storageBytes,
    folder_path: file.relativePath ?? "",
  });
```

- [ ] **Step 4: Persist `folder_path` in the R2-backfill path too**

The `backfillR2Url` helper (around line 531) updates an existing row that was indexed but missing its R2 URL. Add `folder_path` to that update so backfilled rows also get their path. Locate the `.from("photos").update({...})` inside `backfillR2Url` and add `folder_path: file.relativePath ?? ""` to the update object. (If `backfillR2Url` does not currently receive `file`, it already does — it takes `{ file, ... }` per the call site at line 355.)

- [ ] **Step 5: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/events/[id]/sync/route.ts"
git commit -m "feat(archive): sync persists folder_path + backfills it on re-sync"
```

---

## Task 5: `deriveFolderView` pure helper

**Files:**
- Create: `lib/archive/folder-view.ts`
- Create: `__tests__/archive/folder-view.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/archive/folder-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveFolderView } from "@/lib/archive/folder-view";

type P = { id: string; folder_path: string };
const photos: P[] = [
  { id: "a", folder_path: "" },
  { id: "b", folder_path: "พิธีเช้า" },
  { id: "c", folder_path: "พิธีเช้า" },
  { id: "d", folder_path: "พิธีเช้า/ช่วงเช้า" },
  { id: "e", folder_path: "ช่วงเย็น" },
];

describe("deriveFolderView", () => {
  it("at root: lists top folders with recursive counts + photos at root", () => {
    const v = deriveFolderView(photos, "");
    expect(v.photosHere.map((p) => p.id)).toEqual(["a"]);
    expect(v.subfolders).toEqual([
      { name: "พิธีเช้า", path: "พิธีเช้า", count: 3 },
      { name: "ช่วงเย็น", path: "ช่วงเย็น", count: 1 },
    ]);
  });

  it("inside a folder: lists its subfolders + photos directly in it", () => {
    const v = deriveFolderView(photos, "พิธีเช้า");
    expect(v.photosHere.map((p) => p.id)).toEqual(["b", "c"]);
    expect(v.subfolders).toEqual([{ name: "ช่วงเช้า", path: "พิธีเช้า/ช่วงเช้า", count: 1 }]);
  });

  it("leaf folder: photos, no subfolders", () => {
    const v = deriveFolderView(photos, "พิธีเช้า/ช่วงเช้า");
    expect(v.photosHere.map((p) => p.id)).toEqual(["d"]);
    expect(v.subfolders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run __tests__/archive/folder-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `deriveFolderView`**

Create `lib/archive/folder-view.ts`:

```ts
/** A photo only needs its folder_path for the folder-tree derivation. */
export type FolderViewPhoto = { folder_path: string };

export type SubfolderEntry = {
  /** Display name of the immediate subfolder. */
  name: string;
  /** Full folder_path of the subfolder (used as the next `path`). */
  path: string;
  /** Total photos anywhere under this subfolder (recursive). */
  count: number;
};

export type FolderView<T> = {
  /** Immediate subfolders of `path`, in first-seen order. */
  subfolders: SubfolderEntry[];
  /** Photos whose folder_path equals `path` (live directly in this folder). */
  photosHere: T[];
};

/**
 * Split a flat photo list (each carrying folder_path) into the folder view at
 * `path`: the immediate subfolders (with recursive photo counts) and the photos
 * sitting directly in `path`. Pure — drives the file-explorer UI.
 */
export function deriveFolderView<T extends FolderViewPhoto>(
  photos: T[],
  path: string,
): FolderView<T> {
  const prefix = path === "" ? "" : `${path}/`;
  const photosHere: T[] = [];
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const p of photos) {
    const fp = p.folder_path;
    if (fp === path) {
      photosHere.push(p);
      continue;
    }
    if (prefix !== "" ? !fp.startsWith(prefix) : false) continue;
    if (prefix === "" && fp === "") continue;
    const rest = fp.slice(prefix.length); // path below the current folder
    if (rest === "") continue;
    const name = rest.split("/")[0]; // immediate child segment
    const childPath = prefix + name;
    if (!counts.has(childPath)) {
      counts.set(childPath, 0);
      order.push(childPath);
    }
    counts.set(childPath, counts.get(childPath)! + 1);
  }

  const subfolders: SubfolderEntry[] = order.map((childPath) => ({
    name: childPath.slice(prefix.length),
    path: childPath,
    count: counts.get(childPath)!,
  }));

  return { subfolders, photosHere };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run __tests__/archive/folder-view.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/archive/folder-view.ts __tests__/archive/folder-view.test.ts
git commit -m "feat(archive): deriveFolderView pure helper for folder tree"
```

---

## Task 6: File-explorer browse UI in the event gallery

**Files:**
- Modify: `app/dashboard/events/[id]/page.tsx`
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Select + map `folder_path` into `GalleryPhoto`**

In `app/dashboard/events/[id]/page.tsx`, add `folder_path` to the photos `.select(...)` (around line 36):

```ts
        .select("id, r2_web_url, visibility, face_details, storage_file_id, original_filename, taken_at, photographer_name, copyright, folder_path")
```

And in the `.map((p) => ({ ... }))` that builds `photoList` (around line 58), add:

```ts
        folder_path: p.folder_path ?? "",
```

- [ ] **Step 2: Add `folder_path` to the `GalleryPhoto` type**

In `app/dashboard/events/[id]/_photo-gallery.tsx`, extend `GalleryPhoto` (after `copyright`):

```ts
export type GalleryPhoto = {
  id: string;
  r2_web_url: string | null;
  visibility: PhotoVisibility;
  face_details: FaceDetail[];
  storage_file_id: string;
  original_filename: string | null;
  taken_at: string | null;
  photographer_name: string | null;
  copyright: string | null;
  folder_path: string;
};
```

- [ ] **Step 3: Add folder state + derive the view, scoping `visible` to the current folder**

In `app/dashboard/events/[id]/_photo-gallery.tsx`, import the helper and icons at the top:

```ts
import { deriveFolderView } from "@/lib/archive/folder-view";
import { FolderIcon, ChevronRightIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
```

Inside `PhotoGallery`, after the existing state declarations (e.g. after `personFilter`), add the folder-navigation state:

```ts
  // File-explorer navigation (issue: archive folder browse)
  const [path, setPath] = useState("");
  const [flat, setFlat] = useState(false); // true = ignore folders, show whole event
```

Replace the current `visible` derivation so that, in folder mode, the grid is scoped to photos at the current path, and subfolders are derived from the tab-filtered set. Find:

```ts
  // Face count filter + person filter (issue #22) — intersect both layers
  const visible = tabPhotos
    .filter((p) => { /* face count */ })
    .filter((p) => !personFilter || personFilter.photoIds.has(p.id));
```

and change the source set from `tabPhotos` to the folder-scoped set:

```ts
  // Folder view derived from the tab-filtered photos (issue: archive folder browse)
  const { subfolders, photosHere } = deriveFolderView(tabPhotos, path);
  // In folder mode the grid shows photos in THIS folder; flat mode shows the whole event.
  const scoped = flat ? tabPhotos : photosHere;

  const visible = scoped
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

- [ ] **Step 4: Reset lightbox/selection when the folder changes**

Extend the existing `tabFilterKey` (used to reset `activePhotoIdx`/selection) to include `path` and `flat`. Find:

```ts
  const tabFilterKey = `${tab}|${faceFilter}|${personFilter?.faceId ?? ""}`;
```

and replace with:

```ts
  const tabFilterKey = `${tab}|${faceFilter}|${personFilter?.faceId ?? ""}|${flat ? "flat" : path}`;
```

- [ ] **Step 5: Render breadcrumb + flat toggle + subfolder tiles above the grid**

Insert this block immediately before the `{/* ── Empty state ──` block (just after the active-person-filter chip block). It renders the file-explorer header (breadcrumb + toggle) and the subfolder tiles:

```tsx
      {/* ── Folder explorer header (archive folder browse) ───────────────── */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {flat ? (
          <span className="text-zinc-500 dark:text-zinc-400">ทุกรูปในงานนี้</span>
        ) : (
          <nav className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setPath("")}
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              คลัง
            </button>
            {path
              .split("/")
              .filter(Boolean)
              .map((seg, i, arr) => {
                const target = arr.slice(0, i + 1).join("/");
                return (
                  <span key={target} className="flex items-center gap-1">
                    <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-400" />
                    <button
                      type="button"
                      onClick={() => setPath(target)}
                      className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
                    >
                      {seg}
                    </button>
                  </span>
                );
              })}
          </nav>
        )}
        <button
          type="button"
          onClick={() => setFlat((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:border-[#D4AF37] transition-colors"
        >
          <Squares2X2Icon className="h-3.5 w-3.5" />
          {flat ? "ดูเป็นแฟ้ม" : "ดูรวมทั้งงาน"}
        </button>
      </div>

      {/* Subfolder tiles (only in folder mode) */}
      {!flat && subfolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {subfolders.map((sf) => (
            <button
              key={sf.path}
              type="button"
              onClick={() => setPath(sf.path)}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-left hover:border-[#D4AF37] transition-colors"
            >
              <FolderIcon className="h-8 w-8 shrink-0 text-[#D4AF37]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{sf.name}</p>
                <p className="text-xs text-zinc-400">{sf.count} รูป</p>
              </div>
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 6: Make the empty state folder-aware**

The grid/list/lightbox already render from `visible`, so they need no change. Update only the empty-state copy so an empty folder reads sensibly. Find the `visible.length === 0` `EmptyState` and change its `message`:

```tsx
      {visible.length === 0 && subfolders.length === 0 && (
        <EmptyState
          icon={PhotoIcon}
          message={
            personFilter
              ? "บุคคลนี้ไม่มีรูปในแท็บนี้ — ลองสลับแท็บ หรือกด ✕ ล้างตัวกรอง"
              : !flat && path !== ""
                ? "แฟ้มนี้ไม่มีรูป"
                : tab === "hidden"
                  ? "ยังไม่มีรูปที่ไม่เผยแพร่"
                  : "ยังไม่มีรูป"
          }
        />
      )}
```

(The `subfolders.length === 0` guard means: when a folder has only subfolders and no direct photos, show the tiles, not the empty state.)

- [ ] **Step 7: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add "app/dashboard/events/[id]/page.tsx" "app/dashboard/events/[id]/_photo-gallery.tsx"
git commit -m "feat(archive): file-explorer browse — breadcrumb, subfolder tiles, scoped filters, flat toggle"
```

---

## Task 7: Verify in app

- [ ] **Step 1: Start dev**

```bash
npm run dev
```

(Docker Desktop must be running. The app reads `.env.local` → prod Supabase, which now has `photos.folder_path` from Task 1 Step 5.)

- [ ] **Step 2: Re-sync a Drive event that has subfolders**

Open an event whose source Drive folder contains subfolders → click Sync → wait for "done" (auto-resume across 60s windows if large).

Expected: photos that live in subfolders now appear; check a few rows:
```bash
psql "<prod connection>" -c "select folder_path, count(*) from photos where event_id='<id>' group by folder_path order by 1;"
```
(or via `mcp__supabase__execute_sql`). Expected: multiple distinct `folder_path` values, not just ''.

- [ ] **Step 3: Browse the folder tree**

On the event page: you should see subfolder tiles + breadcrumb "คลัง". Click a folder → breadcrumb extends, grid shows that folder's photos + any deeper subfolders. Click a breadcrumb segment → jumps back up.

- [ ] **Step 4: Filters scoped to folder**

Inside a subfolder, apply the face-count filter / person filter / tab switch → they intersect with the current folder only.

- [ ] **Step 5: Flat toggle**

Click "ดูรวมทั้งงาน" → breadcrumb hides, all event photos show (old behavior). Click "ดูเป็นแฟ้ม" → back to folder mode at root.

- [ ] **Step 6: Backfill check**

Confirm previously-synced photos (which had `folder_path = ''`) either moved under their real subfolder after re-sync, or remain at root if they were genuinely at the folder root — and that re-sync did NOT re-download them (watch `[sync-perf]` logs: `skipped: true` for already-done files).

- [ ] **Step 7: Dropbox event**

Repeat Steps 2–3 for a Dropbox-sourced event to confirm recursive listing + paths work there too.

---

## Self-Review

**Spec coverage:**
- [x] Goal 1 (recursive sync) — Task 2 (Dropbox), Task 3 (Drive)
- [x] Goal 2 (store path) — Task 1 (column), Task 4 (persist + backfill)
- [x] Goal 3 (folder browse w/ breadcrumb) — Task 5 (derive), Task 6 (UI)
- [x] Goal 4 (filters/face overlay) — Task 6 Step 3 (scoped `visible`)
- [x] Goal 5 (nothing breaks) — Task 4 preserves doneSet/resume/idempotency; flat toggle keeps old view
- [x] Data model (folder_path text) — Task 1
- [x] Migration/backfill (re-sync) — Task 4 Step 2 + Task 7 Step 6
- [x] Multi-folder-per-event note — folder_path is relative to each connected folder; with the user's 1-folder norm the tree is seamless. (If an event has >1 connected folder, files from different folders can share a relativePath and merge in the view — acceptable for v1; documented limitation.)

**Placeholder scan:** No TBD/TODO; every code step has full code. Task 4 Step 6 git path corrected inline.

**Type consistency:** `SourceFile.relativePath?: string` (Task 2) → consumed as `file.relativePath ?? ""` (Task 4). `GalleryPhoto.folder_path: string` (Task 6) feeds `deriveFolderView` whose `FolderViewPhoto = { folder_path: string }` (Task 5) — compatible. `deriveFolderView` returns `{ subfolders, photosHere }` used verbatim in Task 6.

**Known limitation (documented):** an event with multiple connected folders merges same-named relative paths in the browse view. Out of scope for v1 (user's convention is 1 event = 1 folder).

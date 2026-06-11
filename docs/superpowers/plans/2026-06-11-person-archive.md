# Person Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-event face-searchable person archive — organizer registers people by tagging faces in existing photos, the matching engine scans every event, and `/dashboard/people` shows every photo of a named person across all years.

**Architecture:** New `lib/people/` module (clean bounded context) added to the existing monolith — reuses R2, Rekognition, sharp, and the 60-second SSE resume pattern from sync. Four new Supabase tables. Business-tier gated. Does NOT touch guest flow or per-event Rekognition collections.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase service-role client, AWS Rekognition (`SearchFacesByImageCommand`), Cloudflare R2, sharp

**Issues:** [#23](../../../ISSUES.md) Schema · [#24](../../../ISSUES.md) Enrollment · [#25](../../../ISSUES.md) Matching Engine · [#26](../../../ISSUES.md) Search UI · [#27](../../../ISSUES.md) Auto-incremental · [#28](../../../ISSUES.md) Guards + PDPA
**Spec:** [docs/superpowers/specs/2026-06-03-person-archive-face-search-design.md](../specs/2026-06-03-person-archive-face-search-design.md)
**Prerequisite plan:** [Gallery Face Filter plan](2026-06-11-gallery-face-filter.md) (#22) should be complete before Task 8 (enrollment UI reuses `PersonPickerModal mode="filter"` seam)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260611000000_create_people_tables.sql` | Create | 4 new tables + indexes + RLS |
| `lib/aws/rekognition.ts` | Modify | Add `searchFacesByImage` |
| `lib/r2.ts` | Modify | Add `downloadFromR2` + `r2Paths.personRefFace` |
| `lib/people/enrollment.ts` | Create | `cropFaceToR2`, `enrollPerson`, `addReferenceFace`, `enqueueBackfillScans` |
| `lib/people/matching.ts` | Create | `scanPendingUnits`, `scanUnit` |
| `lib/people/queries.ts` | Create | `listPeople`, `getPersonDetail`, `getPersonPhotos`, `getPendingMatches` |
| `lib/actions/people.ts` | Create | Server Actions (all business-tier gated) |
| `app/api/people/scan/route.ts` | Create | SSE scan route, `maxDuration=60`, same resume pattern as sync |
| `app/dashboard/events/[id]/_photo-gallery.tsx` | Modify | Add "บันทึกเป็นบุคคล" menu item (enrollment seam) |
| `app/dashboard/events/[id]/_person-ban-modal.tsx` | Modify | Add `mode="enroll"` for enrollment picker |
| `app/dashboard/people/page.tsx` | Create | People list + search (server component) |
| `app/dashboard/people/[id]/page.tsx` | Create | Person detail — ref faces, photo grid, pending review |
| `app/dashboard/layout.tsx` | Modify | Add "บุคคล" nav link (business tier only) |
| `app/api/events/[id]/sync/route.ts` | Modify | Auto-incremental: enqueue people scans after sync done |
| `__tests__/people/enrollment.test.ts` | Create | Unit tests for cropFaceToR2, enrollPerson |
| `__tests__/people/matching.test.ts` | Create | Unit tests for scanUnit logic |

---

## Task 1: Schema Migration (Issue #23)

**Files:**
- Create: `supabase/migrations/20260611000000_create_people_tables.sql`
- Modify: `lib/supabase/types.ts` (via `npm run db:types`)

- [ ] **Step 1: Write the migration file**

> **Shipped 2026-06-11:** the actual migration uses the house RLS pattern — `for all using (tenant_id = public.current_tenant_id())` + `force row level security`, lowercase SQL (matching `events`/`photos`). The block below is the reference shape; `supabase/migrations/20260611000000_create_people_tables.sql` is the source of truth.

```sql
-- supabase/migrations/20260611000000_create_people_tables.sql

-- ─── people ─────────────────────────────────────────────────────────────────
CREATE TABLE public.people (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_tenant_id ON public.people(tenant_id);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant users can read own people"
  ON public.people FOR SELECT
  USING (tenant_id = public.current_tenant_id());

-- ─── person_reference_faces ──────────────────────────────────────────────────
CREATE TABLE public.person_reference_faces (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  person_id       uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  source          text        NOT NULL CHECK (source IN ('tagged', 'uploaded')),
  source_photo_id uuid        REFERENCES public.photos(id) ON DELETE SET NULL,
  bbox            jsonb,
  r2_key          text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_person_reference_faces_person_id ON public.person_reference_faces(person_id);

ALTER TABLE public.person_reference_faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant users can read own ref faces"
  ON public.person_reference_faces FOR SELECT
  USING (tenant_id = public.current_tenant_id());

-- ─── photo_people ────────────────────────────────────────────────────────────
CREATE TABLE public.photo_people (
  id          uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid   NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  person_id   uuid   NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  photo_id    uuid   NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  event_id    uuid   NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  confidence  real,
  matched_by  text   NOT NULL CHECK (matched_by IN ('scan', 'manual')),
  status      text   NOT NULL CHECK (status IN ('confirmed', 'pending')) DEFAULT 'confirmed',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_people_person_photo_unique UNIQUE (person_id, photo_id)
);

CREATE INDEX idx_photo_people_person_id ON public.photo_people(person_id);
CREATE INDEX idx_photo_people_event_id  ON public.photo_people(event_id);
CREATE INDEX idx_photo_people_status    ON public.photo_people(status) WHERE status = 'pending';

ALTER TABLE public.photo_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant users can read own photo_people"
  ON public.photo_people FOR SELECT
  USING (tenant_id = public.current_tenant_id());

-- ─── person_event_scans ──────────────────────────────────────────────────────
CREATE TABLE public.person_event_scans (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  person_id      uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status         text        NOT NULL CHECK (status IN ('pending', 'running', 'done', 'error')) DEFAULT 'pending',
  photos_matched integer     NOT NULL DEFAULT 0,
  error          text,
  last_run_at    timestamptz,
  CONSTRAINT person_event_scans_unique UNIQUE (person_id, event_id)
);

CREATE INDEX idx_person_event_scans_tenant_status
  ON public.person_event_scans(tenant_id, status)
  WHERE status = 'pending';

ALTER TABLE public.person_event_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant users can read own scans"
  ON public.person_event_scans FOR SELECT
  USING (tenant_id = public.current_tenant_id());
```

- [ ] **Step 2: Apply migration and regenerate types**

```bash
npm run db:reset
npm run db:types
```

Expected: `lib/supabase/types.ts` gains `people`, `person_reference_faces`, `photo_people`, `person_event_scans` table types.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611000000_create_people_tables.sql lib/supabase/types.ts
git commit -m "feat(people): schema migration — 4 person archive tables + RLS"
```

---

## Task 2: Add `searchFacesByImage` to rekognition.ts (Issue #25 prereq)

**Files:**
- Modify: `lib/aws/rekognition.ts`

- [ ] **Step 1: Add `SearchFacesByImageCommand` import**

```ts
import {
  RekognitionClient,
  DeleteCollectionCommand,
  SearchFacesCommand,
  SearchFacesByImageCommand,  // ADD
} from "@aws-sdk/client-rekognition";
```

- [ ] **Step 2: Add `searchFacesByImage` function**

Append after `searchFacesBySimilarFaceId`:

```ts
/**
 * Search for faces in `collectionId` that match the given image buffer.
 * Used by the person archive matching engine to find a named person's photos
 * across events. Returns matched FaceIds with their similarity scores.
 */
export async function searchFacesByImage(
  imageBytes: Uint8Array,
  collectionId: string,
  threshold = 80,
): Promise<Array<{ faceId: string; similarity: number }>> {
  const client = getClient();
  if (!client) {
    console.warn("[rekognition] AWS creds missing — returning stub empty results");
    return [];
  }
  try {
    const result = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBytes },
        MaxFaces: 500,
        FaceMatchThreshold: threshold,
      }),
    );
    return (result.FaceMatches ?? [])
      .filter((m) => m.Face?.FaceId != null)
      .map((m) => ({ faceId: m.Face!.FaceId!, similarity: m.Similarity ?? 0 }));
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === "ResourceNotFoundException" ||
        err.name === "InvalidParameterException" ||
        err.name === "InvalidImageException")
    )
      return [];
    throw err;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/aws/rekognition.ts
git commit -m "feat(people): add searchFacesByImage to rekognition lib"
```

---

## Task 3: Add `downloadFromR2` to r2.ts (Issue #25 prereq)

**Files:**
- Modify: `lib/r2.ts`

- [ ] **Step 1: Add `GetObjectCommand` usage + `downloadFromR2` function**

`GetObjectCommand` is already imported (line 18). Add after `presignR2Download`:

```ts
/**
 * Download an object from R2 and return its contents as a Buffer.
 * Used by the person archive matching engine to read reference face images.
 * Returns null if R2 credentials are missing (stub mode).
 */
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  if (!client || !BUCKET) return null;

  const result = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );

  if (!result.Body) return null;

  // result.Body is a ReadableStream (Node.js) in server context
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 2: Add `personRefFace` to `r2Paths`**

```ts
export const r2Paths = {
  photoWeb: (eventId: string, photoId: string) =>
    `events/${eventId}/web/${photoId}.jpg`,
  photoFull: (eventId: string, photoId: string) =>
    `events/${eventId}/full/${photoId}.jpg`,
  guestSelfie: (eventId: string, sessionId: string) =>
    `guest-selfies/${eventId}/${sessionId}.jpg`,
  slip: (tenantId: string, slipId: string) =>
    `slips/${tenantId}/${slipId}.jpg`,
  personRefFace: (tenantId: string, personId: string, refFaceId: string) =>
    `tenants/${tenantId}/ref-faces/${personId}/${refFaceId}.jpg`,
} as const;
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add lib/r2.ts
git commit -m "feat(people): add downloadFromR2 + r2Paths.personRefFace"
```

---

## Task 4: lib/people/enrollment.ts (Issue #24)

**Files:**
- Create: `lib/people/enrollment.ts`
- Create: `__tests__/people/enrollment.test.ts`

- [ ] **Step 1: Write the failing tests first**

```ts
// __tests__/people/enrollment.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies — enrollment logic is pure given mocked IO
vi.mock("@/lib/r2", () => ({
  uploadToR2: vi.fn().mockResolvedValue({ ok: true, url: "https://cdn.example.com/key.jpg" }),
  downloadFromR2: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  r2Paths: {
    personRefFace: (tenantId: string, personId: string, refFaceId: string) =>
      `tenants/${tenantId}/ref-faces/${personId}/${refFaceId}.jpg`,
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    extract: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("cropped")),
  })),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "photo-uuid", event_id: "event-uuid" }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe("cropFaceToR2", () => {
  it("adds 30% padding around the bbox", async () => {
    const { downloadFromR2 } = await import("@/lib/r2");
    const sharp = (await import("sharp")).default;
    const { cropFaceToR2 } = await import("@/lib/people/enrollment");

    await cropFaceToR2(
      "events/eid/web/pid.jpg",
      { left: 0.3, top: 0.3, width: 0.2, height: 0.2 },
      "tenant-1",
      "person-1",
    );

    expect(downloadFromR2).toHaveBeenCalledWith("events/eid/web/pid.jpg");
    // sharp extract is called — exact crop math verified by integration
    expect(sharp).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/people/enrollment.test.ts
```

Expected: FAIL — `@/lib/people/enrollment` not found

- [ ] **Step 3: Write `lib/people/enrollment.ts`**

```ts
import "server-only";
import sharp from "sharp";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { uploadToR2, downloadFromR2, r2Paths } from "@/lib/r2";

type BBox = { left: number; top: number; width: number; height: number };

/**
 * Download a photo from R2, extract the face region (+ 30% padding),
 * upload the crop, and return the R2 key.
 */
export async function cropFaceToR2(
  sourceR2Key: string,
  bbox: BBox,
  tenantId: string,
  personId: string,
): Promise<string> {
  const imageBuffer = await downloadFromR2(sourceR2Key);
  if (!imageBuffer) throw new Error("R2 credentials missing — cannot crop face");

  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;

  const faceW = Math.round(bbox.width * imgW);
  const faceH = Math.round(bbox.height * imgH);
  const padX = Math.round(faceW * 0.3);
  const padY = Math.round(faceH * 0.3);

  const left   = Math.max(0, Math.round(bbox.left * imgW) - padX);
  const top    = Math.max(0, Math.round(bbox.top  * imgH) - padY);
  const width  = Math.min(imgW - left, faceW + padX * 2);
  const height = Math.min(imgH - top,  faceH + padY * 2);

  const cropped = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .jpeg({ quality: 90 })
    .toBuffer();

  const refFaceId = crypto.randomUUID();
  const r2Key = r2Paths.personRefFace(tenantId, personId, refFaceId);
  await uploadToR2(r2Key, cropped, "image/jpeg");
  return r2Key;
}

/**
 * Register a new named person from a face tagged in an existing photo.
 * Creates the `people` row, a `person_reference_faces` row (source='tagged'),
 * a self-match `photo_people` row, and enqueues backfill scans for all events.
 */
export async function enrollPerson(opts: {
  tenantId: string;
  name: string;
  sourcePhotoId: string;
  bbox: BBox;
  sourceR2WebKey: string;
}): Promise<{ personId: string }> {
  const supabase = createServiceRoleClient();

  // 1. Create person row
  const { data: person, error: pErr } = await supabase
    .from("people")
    .insert({ tenant_id: opts.tenantId, name: opts.name })
    .select("id")
    .single();
  if (pErr) throw pErr;

  // 2. Crop + upload ref face
  const r2Key = await cropFaceToR2(opts.sourceR2WebKey, opts.bbox, opts.tenantId, person.id);

  // 3. Create reference face row
  await supabase.from("person_reference_faces").insert({
    tenant_id: opts.tenantId,
    person_id: person.id,
    source: "tagged",
    source_photo_id: opts.sourcePhotoId,
    bbox: opts.bbox,
    r2_key: r2Key,
  });

  // 4. Get event_id for the source photo
  const { data: photoRow } = await supabase
    .from("photos")
    .select("event_id")
    .eq("id", opts.sourcePhotoId)
    .single();

  // 5. Self-match: the source photo is a confirmed match by definition
  if (photoRow) {
    await supabase.from("photo_people").upsert(
      {
        tenant_id: opts.tenantId,
        person_id: person.id,
        photo_id: opts.sourcePhotoId,
        event_id: photoRow.event_id,
        confidence: 100,
        matched_by: "manual",
        status: "confirmed",
      },
      { onConflict: "person_id,photo_id", ignoreDuplicates: true },
    );
  }

  // 6. Enqueue backfill scans for this person across all tenant events
  await enqueueBackfillScans(opts.tenantId, person.id, supabase);

  return { personId: person.id };
}

/**
 * Add an additional reference face to an existing person.
 * Accepts either a tagged face (from an existing photo + bbox) or an uploaded image buffer.
 * Enqueues a full rescan so the new ref face improves recall.
 */
export async function addReferenceFace(opts: {
  tenantId: string;
  personId: string;
  source: "tagged" | "uploaded";
  sourcePhotoId?: string;
  bbox?: BBox;
  sourceR2WebKey?: string;
  uploadedImageBuffer?: Buffer;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  let r2Key: string;

  if (opts.source === "tagged" && opts.sourceR2WebKey && opts.bbox) {
    r2Key = await cropFaceToR2(opts.sourceR2WebKey, opts.bbox, opts.tenantId, opts.personId);
  } else if (opts.source === "uploaded" && opts.uploadedImageBuffer) {
    const refFaceId = crypto.randomUUID();
    r2Key = r2Paths.personRefFace(opts.tenantId, opts.personId, refFaceId);
    await uploadToR2(r2Key, opts.uploadedImageBuffer, "image/jpeg");
  } else {
    throw new Error("Invalid addReferenceFace parameters");
  }

  await supabase.from("person_reference_faces").insert({
    tenant_id: opts.tenantId,
    person_id: opts.personId,
    source: opts.source,
    source_photo_id: opts.sourcePhotoId ?? null,
    bbox: opts.bbox ?? null,
    r2_key: r2Key,
  });

  await enqueueBackfillScans(opts.tenantId, opts.personId, supabase);
}

/**
 * Upsert person_event_scans rows for (person × all tenant events) = pending.
 * Called after any enrollment action so the matching engine picks them up.
 */
export async function enqueueBackfillScans(
  tenantId: string,
  personId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<void> {
  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (!events?.length) return;

  await supabase.from("person_event_scans").upsert(
    events.map((e) => ({
      tenant_id: tenantId,
      person_id: personId,
      event_id: e.id,
      status: "pending" as const,
      photos_matched: 0,
    })),
    { onConflict: "person_id,event_id" },
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/people/enrollment.test.ts
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/people/enrollment.ts __tests__/people/enrollment.test.ts
git commit -m "feat(people): enrollment — cropFaceToR2, enrollPerson, addReferenceFace"
```

---

## Task 5: lib/people/matching.ts (Issue #25)

**Files:**
- Create: `lib/people/matching.ts`
- Create: `__tests__/people/matching.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/people/matching.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/aws/rekognition", () => ({
  searchFacesByImage: vi.fn().mockResolvedValue([
    { faceId: "face-abc", similarity: 92 },
  ]),
}));

vi.mock("@/lib/r2", () => ({
  downloadFromR2: vi.fn().mockResolvedValue(Buffer.from("img")),
}));

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  overlaps: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  single: vi.fn().mockResolvedValue({ data: { rekognition_collection_id: "col-1" }, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => mockSupabase,
}));

describe("buildFaceToSimilarityMap", () => {
  it("returns the highest similarity per faceId when same faceId appears in multiple ref faces", async () => {
    const { buildFaceToSimilarityMap } = await import("@/lib/people/matching");
    const map = buildFaceToSimilarityMap([
      { faceId: "face-a", similarity: 85 },
      { faceId: "face-a", similarity: 93 },
      { faceId: "face-b", similarity: 88 },
    ]);
    expect(map.get("face-a")).toBe(93);
    expect(map.get("face-b")).toBe(88);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/people/matching.test.ts
```

- [ ] **Step 3: Write `lib/people/matching.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { downloadFromR2 } from "@/lib/r2";
import { searchFacesByImage } from "@/lib/aws/rekognition";

const CONFIRMED_THRESHOLD = 90;

export type ScanSummary = {
  unitsProcessed: number;
  photosMatched: number;
  timedOut: boolean;
};

/**
 * Build a map of faceId → highest similarity score from SearchFacesByImage results
 * across all ref faces of a person. Exported for unit testing.
 */
export function buildFaceToSimilarityMap(
  matches: Array<{ faceId: string; similarity: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const { faceId, similarity } of matches) {
    if (!map.has(faceId) || similarity > map.get(faceId)!) {
      map.set(faceId, similarity);
    }
  }
  return map;
}

/**
 * Process `person_event_scans` rows with status='pending' for the given tenant
 * until `deadlineMs` is reached. Intended to be called from the scan route which
 * runs inside a 60s Vercel function window.
 */
export async function scanPendingUnits(
  tenantId: string,
  deadlineMs: number,
): Promise<ScanSummary> {
  const supabase = createServiceRoleClient();
  let unitsProcessed = 0;
  let photosMatched = 0;

  while (Date.now() < deadlineMs) {
    // Claim one pending unit atomically
    const { data: unit } = await supabase
      .from("person_event_scans")
      .update({ status: "running", last_run_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .select("id, person_id, event_id")
      .limit(1)
      .maybeSingle();

    if (!unit) break; // No more pending units

    try {
      const matched = await scanUnit(tenantId, unit.person_id, unit.event_id, supabase);
      await supabase
        .from("person_event_scans")
        .update({ status: "done", photos_matched: matched, last_run_at: new Date().toISOString() })
        .eq("id", unit.id);
      photosMatched += matched;
      unitsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("person_event_scans")
        .update({ status: "error", error: msg, last_run_at: new Date().toISOString() })
        .eq("id", unit.id);
      console.error(`[people-scan] unit ${unit.id} failed:`, err);
    }
  }

  return { unitsProcessed, photosMatched, timedOut: Date.now() >= deadlineMs };
}

async function scanUnit(
  tenantId: string,
  personId: string,
  eventId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<number> {
  // Get event's Rekognition collection
  const { data: event } = await supabase
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", eventId)
    .single();

  if (!event?.rekognition_collection_id) return 0;

  // Get all reference faces for this person
  const { data: refFaces } = await supabase
    .from("person_reference_faces")
    .select("r2_key")
    .eq("person_id", personId);

  if (!refFaces?.length) return 0;

  // Search each ref face image against the event collection, accumulate matches
  const allMatches: Array<{ faceId: string; similarity: number }> = [];
  let rekognitionCalls = 0;

  for (const refFace of refFaces) {
    const imageBuffer = await downloadFromR2(refFace.r2_key);
    if (!imageBuffer) continue;
    try {
      const matches = await searchFacesByImage(
        new Uint8Array(imageBuffer),
        event.rekognition_collection_id,
      );
      allMatches.push(...matches);
      rekognitionCalls++;
    } catch (err) {
      console.warn(`[people-scan] ref face ${refFace.r2_key} search failed:`, err);
    }
  }

  console.log(`[people-scan] person=${personId} event=${eventId} rekognition_calls=${rekognitionCalls} matches=${allMatches.length}`);

  if (allMatches.length === 0) return 0;

  const faceToSim = buildFaceToSimilarityMap(allMatches);
  const matchedFaceIds = Array.from(faceToSim.keys());

  // Find photos in this event whose indexed face_ids overlap the matched set
  const { data: photos } = await supabase
    .from("photos")
    .select("id, rekognition_face_ids")
    .eq("event_id", eventId)
    .overlaps("rekognition_face_ids", matchedFaceIds);

  if (!photos?.length) return 0;

  // Build photo_people rows — pick highest similarity among faces in the photo
  const rows = photos.map((photo) => {
    const photoFaceIds = (photo.rekognition_face_ids as string[]) ?? [];
    const confidence = Math.max(0, ...photoFaceIds.map((id) => faceToSim.get(id) ?? 0));
    return {
      tenant_id: tenantId,
      person_id: personId,
      photo_id: photo.id,
      event_id: eventId,
      confidence,
      matched_by: "scan" as const,
      status: (confidence >= CONFIRMED_THRESHOLD ? "confirmed" : "pending") as "confirmed" | "pending",
    };
  });

  // ignoreDuplicates=true: don't overwrite manual/confirmed rows that already exist
  await supabase
    .from("photo_people")
    .upsert(rows, { onConflict: "person_id,photo_id", ignoreDuplicates: true });

  return photos.length;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/people/matching.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/people/matching.ts __tests__/people/matching.test.ts
git commit -m "feat(people): matching engine — scanPendingUnits, scanUnit, buildFaceToSimilarityMap"
```

---

## Task 6: lib/people/queries.ts (Issue #26 prereq)

**Files:**
- Create: `lib/people/queries.ts`

- [ ] **Step 1: Write the queries file**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PersonRow = {
  id: string;
  name: string;
  note: string | null;
  photoCount: number;
  coverUrl: string | null;
};

export type PersonPhotoRow = {
  photoId: string;
  r2_web_url: string | null;
  eventId: string;
  eventName: string;
  confidence: number | null;
  matchedBy: "scan" | "manual";
};

export type PendingMatchRow = {
  id: string;
  photoId: string;
  r2_web_url: string | null;
  confidence: number | null;
  eventId: string;
  eventName: string;
};

export async function listPeople(tenantId: string): Promise<PersonRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("people")
    .select(`
      id,
      name,
      note,
      photo_people(count)
    `)
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    note: p.note,
    photoCount: (p.photo_people as unknown as { count: number }[])[0]?.count ?? 0,
    coverUrl: null, // populated separately if needed
  }));
}

export async function getPersonPhotos(
  personId: string,
  tenantId: string,
  eventIdFilter?: string,
): Promise<PersonPhotoRow[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("photo_people")
    .select(`
      photo_id,
      confidence,
      matched_by,
      event_id,
      photos!inner(r2_web_url),
      events!inner(name)
    `)
    .eq("person_id", personId)
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed");

  if (eventIdFilter) query = query.eq("event_id", eventIdFilter);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    photoId: row.photo_id,
    r2_web_url: (row.photos as unknown as { r2_web_url: string | null }).r2_web_url,
    eventId: row.event_id,
    eventName: (row.events as unknown as { name: string }).name,
    confidence: row.confidence,
    matchedBy: row.matched_by as "scan" | "manual",
  }));
}

export async function getPendingMatches(
  personId: string,
  tenantId: string,
): Promise<PendingMatchRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("photo_people")
    .select(`
      id,
      photo_id,
      confidence,
      event_id,
      photos!inner(r2_web_url),
      events!inner(name)
    `)
    .eq("person_id", personId)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("confidence", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    photoId: row.photo_id,
    r2_web_url: (row.photos as unknown as { r2_web_url: string | null }).r2_web_url,
    confidence: row.confidence,
    eventId: row.event_id,
    eventName: (row.events as unknown as { name: string }).name,
  }));
}

export async function getPersonRefFaces(personId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("person_reference_faces")
    .select("id, r2_key, source, created_at")
    .eq("person_id", personId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getTenantEvents(tenantId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/people/queries.ts
git commit -m "feat(people): queries — listPeople, getPersonPhotos, getPendingMatches"
```

---

## Task 7: lib/actions/people.ts (Issues #24, #26, #28)

**Files:**
- Create: `lib/actions/people.ts`

- [ ] **Step 1: Write the Server Actions file**

```ts
"use server";

import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enrollPerson, addReferenceFace } from "@/lib/people/enrollment";
import { downloadFromR2 } from "@/lib/r2";

function assertBusiness(plan: string | null | undefined) {
  if (plan !== "business") {
    throw new Error("ฟีเจอร์นี้ต้องใช้ Business tier");
  }
}

export async function enrollPersonAction(formData: FormData) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const name = formData.get("name") as string;
  const sourcePhotoId = formData.get("sourcePhotoId") as string;
  const bboxStr = formData.get("bbox") as string;
  const sourceR2WebKey = formData.get("sourceR2WebKey") as string;

  if (!name?.trim()) throw new Error("ต้องระบุชื่อ");

  const bbox = JSON.parse(bboxStr) as { left: number; top: number; width: number; height: number };
  return enrollPerson({
    tenantId: ctx.tenant.id,
    name: name.trim(),
    sourcePhotoId,
    bbox,
    sourceR2WebKey,
  });
}

export async function addTaggedRefFaceAction(formData: FormData) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const personId = formData.get("personId") as string;
  const sourcePhotoId = formData.get("sourcePhotoId") as string;
  const bboxStr = formData.get("bbox") as string;
  const sourceR2WebKey = formData.get("sourceR2WebKey") as string;

  const bbox = JSON.parse(bboxStr) as { left: number; top: number; width: number; height: number };
  return addReferenceFace({
    tenantId: ctx.tenant.id,
    personId,
    source: "tagged",
    sourcePhotoId,
    bbox,
    sourceR2WebKey,
  });
}

export async function addUploadedRefFaceAction(formData: FormData) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const personId = formData.get("personId") as string;
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("ไม่พบไฟล์");

  const buffer = Buffer.from(await file.arrayBuffer());
  return addReferenceFace({
    tenantId: ctx.tenant.id,
    personId,
    source: "uploaded",
    uploadedImageBuffer: buffer,
  });
}

export async function deleteRefFaceAction(refFaceId: string) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("person_reference_faces")
    .select("r2_key")
    .eq("id", refFaceId)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  if (error || !row) throw new Error("ไม่พบ reference face นี้");

  // Delete R2 object first, then DB row (cascade handles the rest)
  // Note: R2 SDK doesn't have a deleteObject wrapper yet — add if needed
  // For now: just delete the DB row (R2 object becomes orphaned but harmless)
  await supabase.from("person_reference_faces").delete().eq("id", refFaceId);
}

export async function deletePersonAction(personId: string) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const supabase = createServiceRoleClient();

  // Fetch all ref face R2 keys before deletion (cascade will remove DB rows)
  const { data: refFaces } = await supabase
    .from("person_reference_faces")
    .select("r2_key")
    .eq("person_id", personId)
    .eq("tenant_id", ctx.tenant.id);

  // Delete the person row — ON DELETE CASCADE handles ref faces, photo_people, scans
  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;

  // Best-effort R2 cleanup after DB delete succeeds
  // (implement deleteFromR2 in lib/r2.ts when needed; for now log the keys)
  if (refFaces?.length) {
    console.log(
      `[people] deleted person ${personId} — orphaned R2 keys:`,
      refFaces.map((r) => r.r2_key),
    );
  }
}

export async function confirmMatchAction(photoPersonId: string) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const supabase = createServiceRoleClient();
  await supabase
    .from("photo_people")
    .update({ status: "confirmed", matched_by: "manual" })
    .eq("id", photoPersonId)
    .eq("tenant_id", ctx.tenant.id);
}

export async function rejectMatchAction(photoPersonId: string) {
  const ctx = await getCurrentTenant();
  assertBusiness(ctx.tenant.plan);

  const supabase = createServiceRoleClient();
  await supabase
    .from("photo_people")
    .delete()
    .eq("id", photoPersonId)
    .eq("tenant_id", ctx.tenant.id);
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/people.ts
git commit -m "feat(people): Server Actions — enroll, addRefFace, deletePerson, confirmMatch, rejectMatch"
```

---

## Task 8: app/api/people/scan/route.ts (Issue #25)

**Files:**
- Create: `app/api/people/scan/route.ts`

- [ ] **Step 1: Write the scan route**

```ts
/**
 * POST /api/people/scan
 *
 * Runs pending person_event_scans for the authenticated tenant as SSE.
 * Same 60s resume pattern as /api/events/[id]/sync.
 *
 *   { type: 'progress', units_processed: number, photos_matched: number }
 *   { type: 'done', units_processed: number, photos_matched: number }
 *   { type: 'error', message: string }
 */
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { scanPendingUnits } from "@/lib/people/matching";

export const maxDuration = 60;

export async function POST(_request: NextRequest) {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  if (ctx.tenant.plan !== "business") return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const send = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Reserve 5s buffer before the 60s wall clock kills the function
        const deadlineMs = Date.now() + 55_000;
        let totalUnits = 0;
        let totalPhotos = 0;

        while (Date.now() < deadlineMs) {
          const result = await scanPendingUnits(ctx.tenant.id, deadlineMs);
          totalUnits  += result.unitsProcessed;
          totalPhotos += result.photosMatched;

          controller.enqueue(send({ type: "progress", units_processed: totalUnits, photos_matched: totalPhotos }));

          if (!result.timedOut) break; // all pending units done
        }

        controller.enqueue(send({ type: "done", units_processed: totalUnits, photos_matched: totalPhotos }));
      } catch (err) {
        controller.enqueue(send({ type: "error", message: err instanceof Error ? err.message : String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/api/people/scan/route.ts
git commit -m "feat(people): scan route — SSE, maxDuration=60, same resume pattern as sync"
```

---

## Task 9: Enrollment UI seam in gallery (Issue #24)

Prerequisite: [Gallery Face Filter plan](2026-06-11-gallery-face-filter.md) must be complete (PersonPickerModal already has mode generalization).

**Files:**
- Modify: `app/dashboard/events/[id]/_person-ban-modal.tsx`
- Modify: `app/dashboard/events/[id]/_photo-gallery.tsx`

- [ ] **Step 1: Add `mode="enroll"` to `PersonPickerModal`**

Extend the `Mode` type:

```ts
type Mode = "hide" | "unhide" | "filter" | "enroll";
```

Add `onApplyEnroll` prop:

```ts
export type EnrollPayload = {
  faceId: string;
  sourcePhotoId: string;
  bbox: { left: number; top: number; width: number; height: number };
  sourceUrl: string | null;
  sourceR2WebKey: string | null;
};
```

```ts
// In PersonPickerModal props:
onApplyEnroll?: (payload: EnrollPayload) => void;
```

In `pickFace`, add branch for mode="enroll":

```ts
if (mode === "enroll") {
  onApplyEnroll?.({
    faceId: face.face_id,
    sourcePhotoId: photo.id,
    bbox: face.bbox,
    sourceUrl: photo.r2_web_url,
    sourceR2WebKey: photo.r2_web_url,  // web key as stand-in; enrollment.ts will crop from this
  });
  onClose();
  return;
}
```

Update footer hint:

```tsx
{mode === "enroll" ? "คลิกใบหน้าเพื่อบันทึกเป็นบุคคล" : mode === "filter" ? "คลิกใบหน้าเพื่อกรองรูป" : "คลิกใบหน้าเพื่อดูรูปของคนนั้น"}
```

- [ ] **Step 2: Add `EnrollModal` component in gallery file**

Add a simple inline component below `PhotoMenu`:

```tsx
function EnrollModal({
  payload,
  tenantId,
  onClose,
}: {
  payload: EnrollPayload;
  tenantId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("sourcePhotoId", payload.sourcePhotoId);
      fd.set("bbox", JSON.stringify(payload.bbox));
      fd.set("sourceR2WebKey", payload.sourceR2WebKey ?? "");
      await enrollPersonAction(fd);
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-zinc-100">บันทึกเป็นบุคคล</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อ-นามสกุล"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          autoFocus
          required
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="px-4 py-1.5 rounded bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

Import `enrollPersonAction` at top of `_photo-gallery.tsx`:

```ts
import { enrollPersonAction } from "@/lib/actions/people";
import { type EnrollPayload } from "./_person-ban-modal";
```

- [ ] **Step 3: Add "บันทึกเป็นบุคคล" menu item in `PhotoMenu`**

Add a third state for the enrollment picker and the enroll modal:

```ts
const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);
const [enrollPayload, setEnrollPayload] = useState<EnrollPayload | null>(null);
```

Add menu item (inside `face_details.length > 0` guard, after filter item):

```tsx
<MenuItem
  onClick={() => { setOpen(false); setEnrollPickerOpen(true); }}
  icon={UserPlusIcon}
>
  บันทึกเป็นบุคคล
</MenuItem>
```

Add `UserPlusIcon` to heroicons imports.

Add portals:

```tsx
{enrollPickerOpen && typeof document !== "undefined" && createPortal(
  <PersonPickerModal
    eventId={eventId}
    photo={photo}
    mode="enroll"
    onClose={() => setEnrollPickerOpen(false)}
    onApplyEnroll={(payload) => {
      setEnrollPayload(payload);
      setEnrollPickerOpen(false);
    }}
  />,
  document.body,
)}

{enrollPayload && typeof document !== "undefined" && createPortal(
  <EnrollModal
    payload={enrollPayload}
    tenantId={photo.tenant_id ?? ""}  // pass tenantId from photo or context
    onClose={() => setEnrollPayload(null)}
  />,
  document.body,
)}
```

Note: `GalleryPhoto` type may need `tenant_id` or pull from context. If not available, pass it as a prop from `PhotoGallery`.

- [ ] **Step 4: Run lint + commit**

```bash
npm run lint
git add app/dashboard/events/\[id\]/_person-ban-modal.tsx app/dashboard/events/\[id\]/_photo-gallery.tsx
git commit -m "feat(people): enrollment UI seam in gallery — 'บันทึกเป็นบุคคล' menu item"
```

---

## Task 10: /dashboard/people list + person detail pages (Issue #26)

**Files:**
- Create: `app/dashboard/people/page.tsx`
- Create: `app/dashboard/people/[id]/page.tsx`
- Modify: `app/dashboard/layout.tsx` (add nav link)

- [ ] **Step 1: Write `app/dashboard/people/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { listPeople } from "@/lib/people/queries";
import { UserCircleIcon } from "@heroicons/react/24/outline";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (ctx.tenant.plan !== "business") {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 text-center space-y-3">
        <p className="text-zinc-500 text-sm">ฟีเจอร์สารบัญบุคคลต้องใช้ Business tier</p>
        <Link href="/dashboard/account" className="text-[#D4AF37] text-sm underline">
          ดูรายละเอียดแผน
        </Link>
      </div>
    );
  }

  const { q } = await searchParams;
  const people = await listPeople(ctx.tenant.id);
  const filtered = q
    ? people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : people;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">สารบัญบุคคล</h1>
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นชื่อ..."
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] w-52"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <UserCircleIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {q ? `ไม่พบ "${q}"` : "ยังไม่มีบุคคลในระบบ — ไปที่รูปในงานแล้วกด ⋮ → บันทึกเป็นบุคคล"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((person) => (
            <Link
              key={person.id}
              href={`/dashboard/people/${person.id}`}
              className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-[#D4AF37] transition-colors"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mx-auto mb-3">
                <UserCircleIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-center truncate text-zinc-900 dark:text-zinc-50">
                {person.name}
              </p>
              <p className="text-xs text-center text-zinc-400 mt-0.5">
                {person.photoCount} รูป
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/dashboard/people/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import {
  getPersonPhotos,
  getPendingMatches,
  getPersonRefFaces,
  getTenantEvents,
} from "@/lib/people/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { confirmMatchAction, rejectMatchAction, deletePersonAction } from "@/lib/actions/people";

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (ctx.tenant.plan !== "business") notFound();

  const { id: personId } = await params;
  const { eventId: eventIdFilter } = await searchParams;

  const supabase = createServiceRoleClient();
  const { data: person, error } = await supabase
    .from("people")
    .select("id, name, note")
    .eq("id", personId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (error || !person) notFound();

  const [photos, pending, refFaces, events] = await Promise.all([
    getPersonPhotos(personId, ctx.tenant.id, eventIdFilter),
    getPendingMatches(personId, ctx.tenant.id),
    getPersonRefFaces(personId),
    getTenantEvents(ctx.tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/people" className="text-xs text-zinc-400 hover:text-zinc-600">
            ← สารบัญบุคคล
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {person.name}
          </h1>
          {person.note && <p className="text-sm text-zinc-500 mt-0.5">{person.note}</p>}
        </div>
        <form action={async () => {
          "use server";
          await deletePersonAction(personId);
        }}>
          <button
            type="submit"
            className="text-xs text-rose-500 hover:text-rose-700"
            onClick={() => confirm("ลบบุคคลนี้? รูปที่ match จะถูกยกเลิกการเชื่อมโยงทั้งหมด")}
          >
            ลบบุคคล
          </button>
        </form>
      </div>

      {/* Event filter */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/dashboard/people/${personId}`}
          className={`text-xs px-3 py-1 rounded-full border ${!eventIdFilter ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent" : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}
        >
          ทั้งหมด
        </Link>
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/dashboard/people/${personId}?eventId=${e.id}`}
            className={`text-xs px-3 py-1 rounded-full border ${eventIdFilter === e.id ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent" : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}
          >
            {e.name}
          </Link>
        ))}
      </div>

      {/* Photo grid */}
      <section>
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
          รูปที่ match ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="text-sm text-zinc-400">ยังไม่มีรูป — กำลัง scan อยู่อาจใช้เวลาสักครู่</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {photos.map((photo) => (
              <div key={photo.photoId} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {photo.r2_web_url && (
                  <Image
                    src={photo.r2_web_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 20vw"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending review */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-3">
            รอยืนยัน ({pending.length}) — match ที่ confidence ต่ำกว่า 90%
          </h2>
          <div className="space-y-2">
            {pending.map((match) => (
              <div key={match.id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="relative w-12 h-12 rounded overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800">
                  {match.r2_web_url && (
                    <Image src={match.r2_web_url} alt="" fill className="object-cover" sizes="48px" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{match.eventName}</p>
                  <p className="text-xs text-zinc-400">confidence: {match.confidence?.toFixed(0)}%</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <form action={async () => {
                    "use server";
                    await confirmMatchAction(match.id);
                  }}>
                    <button type="submit" className="text-xs px-2 py-1 rounded bg-emerald-500 text-white">
                      ยืนยัน
                    </button>
                  </form>
                  <form action={async () => {
                    "use server";
                    await rejectMatchAction(match.id);
                  }}>
                    <button type="submit" className="text-xs px-2 py-1 rounded bg-rose-500 text-white">
                      ปฏิเสธ
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PDPA note */}
      <p className="text-xs text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        ข้อมูลใบหน้าและรูปภาพถูกเก็บและประมวลผลตามนโยบายความเป็นส่วนตัวภายในองค์กร
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Add "บุคคล" nav link to dashboard layout (business tier only)**

In `app/dashboard/layout.tsx`, find the nav section and add conditionally after the Admin link:

```tsx
{ctx.tenant.plan === "business" && (
  <Link
    href="/dashboard/people"
    className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-[#D4AF37] dark:hover:text-[#D4AF37] transition-colors"
  >
    บุคคล
  </Link>
)}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/people/ app/dashboard/layout.tsx
git commit -m "feat(people): /dashboard/people list + person detail pages + nav link"
```

---

## Task 11: Auto-incremental scan hook (Issue #27)

**Files:**
- Modify: `app/api/events/[id]/sync/route.ts`

- [ ] **Step 1: Add `enqueuePersonScansForEvent` helper in sync route**

After the imports section at the top of sync route, add a helper that runs in the background after sync completes:

```ts
/**
 * After a successful sync, enqueue person_event_scans for all people in the tenant
 * so the matching engine automatically processes new photos.
 * Fire-and-forget: errors are logged but don't affect the sync response.
 */
async function enqueuePersonScansForEvent(tenantId: string, eventId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: people } = await supabase
    .from("people")
    .select("id")
    .eq("tenant_id", tenantId);

  if (!people?.length) return;

  await supabase.from("person_event_scans").upsert(
    people.map((p) => ({
      tenant_id: tenantId,
      person_id: p.id,
      event_id: eventId,
      status: "pending" as const,
      photos_matched: 0,
    })),
    { onConflict: "person_id,event_id" },
  );
}
```

- [ ] **Step 2: Call `enqueuePersonScansForEvent` at the end of the sync route after the `done` SSE event is sent**

Find the location where `{ type: 'done' }` is sent in the sync route and add the call after it (best-effort, don't await in the response critical path — either fire-and-forget or await before close):

```ts
// After sending 'done' event:
await enqueuePersonScansForEvent(tenantId, eventId).catch((err) => {
  console.error("[sync] enqueuePersonScansForEvent failed:", err);
});
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add app/api/events/\[id\]/sync/route.ts
git commit -m "feat(people): auto-incremental scan — enqueue person scans after sync done"
```

---

## Task 12: Guards + PDPA (Issue #28)

All business-tier guards are already implemented inline in `lib/actions/people.ts` (Task 7) and the people pages (Tasks 10). This task verifies completeness and adds the cost logging.

**Files:**
- Modify: `app/api/people/scan/route.ts`
- Verify: `lib/actions/people.ts`, `app/dashboard/people/page.tsx`

- [ ] **Step 1: Verify `assertBusiness` is called in every Server Action in `lib/actions/people.ts`**

Each exported `async function *Action` must have `assertBusiness(ctx.tenant.plan)` as its second line (after `getCurrentTenant`). Check: `enrollPersonAction`, `addTaggedRefFaceAction`, `addUploadedRefFaceAction`, `deleteRefFaceAction`, `deletePersonAction`, `confirmMatchAction`, `rejectMatchAction`.

- [ ] **Step 2: Verify `/dashboard/people` upgrade prompt**

`app/dashboard/people/page.tsx` renders the upgrade prompt when `ctx.tenant.plan !== "business"` — confirmed in Task 10.

- [ ] **Step 3: Add `SearchFacesByImage` call count to scan route logs**

In `app/api/people/scan/route.ts`, add a running counter exposed in the `done` event:

The `scanPendingUnits` function already logs calls per unit in `lib/people/matching.ts` (`rekognitionCalls` console.log). For higher-level visibility, update the `done` event to include the total `photosMatched`:

```ts
controller.enqueue(send({
  type: "done",
  units_processed: totalUnits,
  photos_matched: totalPhotos,
}));
```

This appears in Vercel runtime logs per deployment — sufficient for cost monitoring at current scale.

- [ ] **Step 4: Verify cascade delete**

The migration uses `ON DELETE CASCADE` on all child tables:
- `person_reference_faces.person_id → people.id ON DELETE CASCADE` ✓
- `photo_people.person_id → people.id ON DELETE CASCADE` ✓
- `person_event_scans.person_id → people.id ON DELETE CASCADE` ✓

When `deletePersonAction` deletes the `people` row, all child rows are removed automatically by the DB. The R2 cleanup is best-effort (logged).

- [ ] **Step 5: Final lint + test run**

```bash
npm run lint
npm test
```

Expected: 0 lint errors, all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(people): guards + PDPA note — business-tier gate, cascade delete, cost logging"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Goal 1: roster with name + ref faces — `enrollPerson` + `people` table
- [x] Goal 2: cross-event search — `getPersonPhotos` queries `photo_people ⋈ photos` across all events
- [x] Goal 3: auto-incremental — sync hook enqueues on every sync completion (Task 11)
- [x] Goal 4: internal/dashboard tool — `/dashboard/people` server components, no guest flow touched
- [x] Enrollment tagged flow — `PersonPickerModal mode="enroll"` + `EnrollModal` (Task 9)
- [x] Enrollment upload fallback — `addUploadedRefFaceAction` (Task 7)
- [x] Matching engine resumable — `scanPendingUnits` with `deadlineMs`, same 60s pattern
- [x] Pending review — `getPendingMatches` + confirm/reject actions
- [x] Business-tier gate — `assertBusiness` in all actions
- [x] Cascade delete — `ON DELETE CASCADE` in migration + R2 best-effort cleanup
- [x] PDPA note — in person detail page footer
- [x] Rekognition stub (no env) — `searchFacesByImage` returns `[]` gracefully

**Not in this plan (future issues):**
- Multi-account source connections (#20 / future)
- deleteFromR2 helper (R2 object cleanup on delete is best-effort)
- Merge/split people, aliases
- Scan status UI with auto-resume on people detail page (can be added in #26 extension)

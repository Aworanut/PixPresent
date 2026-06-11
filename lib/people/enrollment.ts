// Person-archive enrollment: register named people by tagging a face in an
// existing photo (or uploading a reference image), crop the face to R2, and
// queue a backfill scan across every event. Writes go through the service role.
//
// Note: photos.r2_web_url stores a public URL, NOT an R2 key — so callers pass
// the source *photo id*; we rebuild the web key via r2Paths.photoWeb().

import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { uploadToR2, downloadFromR2, r2Paths } from "@/lib/r2";

type BBox = { left: number; top: number; width: number; height: number };
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Download a photo from R2, extract the face region (+30% padding, clamped to
 * the image bounds), upload the crop, and return its R2 key. The crop is the
 * single-face reference image used by SearchFacesByImage at scan time.
 */
export async function cropFaceToR2(
  sourceR2Key: string,
  bbox: BBox,
  tenantId: string,
  personId: string,
): Promise<string> {
  const imageBuffer = await downloadFromR2(sourceR2Key);
  if (!imageBuffer) throw new Error("R2 credentials missing — cannot crop reference face");

  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (!imgW || !imgH) throw new Error("Could not read source image dimensions");

  const faceW = Math.round(bbox.width * imgW);
  const faceH = Math.round(bbox.height * imgH);
  const padX = Math.round(faceW * 0.3);
  const padY = Math.round(faceH * 0.3);

  const left = Math.max(0, Math.round(bbox.left * imgW) - padX);
  const top = Math.max(0, Math.round(bbox.top * imgH) - padY);
  const width = Math.min(imgW - left, faceW + padX * 2);
  const height = Math.min(imgH - top, faceH + padY * 2);

  const cropped = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .jpeg({ quality: 90 })
    .toBuffer();

  const r2Key = r2Paths.personRefFace(tenantId, personId, randomUUID());
  await uploadToR2(r2Key, cropped, "image/jpeg");
  return r2Key;
}

/**
 * Register a new named person from a face tagged in an existing photo.
 * Creates the people row, a tagged reference face, a confirmed self-match, and
 * enqueues a backfill scan across all events.
 */
export async function enrollPerson(opts: {
  tenantId: string;
  name: string;
  sourcePhotoId: string;
  bbox: BBox;
}): Promise<{ personId: string }> {
  const supabase = createServiceRoleClient();

  // 1. Resolve the source photo's event (gives us the web R2 key to crop from)
  const { data: photoRow, error: photoErr } = await supabase
    .from("photos")
    .select("event_id")
    .eq("id", opts.sourcePhotoId)
    .single();
  if (photoErr || !photoRow) throw new Error("ไม่พบรูปต้นทาง");

  // 2. Create the person
  const { data: person, error: pErr } = await supabase
    .from("people")
    .insert({ tenant_id: opts.tenantId, name: opts.name })
    .select("id")
    .single();
  if (pErr || !person) throw pErr ?? new Error("สร้างบุคคลไม่สำเร็จ");

  // 3. Crop the face from the web derivative → reference face row
  const sourceWebKey = r2Paths.photoWeb(photoRow.event_id, opts.sourcePhotoId);
  const r2Key = await cropFaceToR2(sourceWebKey, opts.bbox, opts.tenantId, person.id);

  await supabase.from("person_reference_faces").insert({
    tenant_id: opts.tenantId,
    person_id: person.id,
    source: "tagged",
    source_photo_id: opts.sourcePhotoId,
    bbox: opts.bbox,
    r2_key: r2Key,
  });

  // 4. The source photo is a confirmed match by definition
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

  // 5. Backfill: scan this person against every event
  await enqueueBackfillScans(opts.tenantId, person.id, supabase);

  return { personId: person.id };
}

/**
 * Add another reference face to an existing person — either tagged from a photo
 * (needs eventId + sourcePhotoId + bbox) or uploaded directly. Re-queues a
 * backfill so the new face improves recall.
 */
export async function addReferenceFace(opts: {
  tenantId: string;
  personId: string;
  source: "tagged" | "uploaded";
  sourcePhotoId?: string;
  eventId?: string;
  bbox?: BBox;
  uploadedImageBuffer?: Buffer;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  let r2Key: string;

  if (opts.source === "tagged" && opts.sourcePhotoId && opts.eventId && opts.bbox) {
    const sourceWebKey = r2Paths.photoWeb(opts.eventId, opts.sourcePhotoId);
    r2Key = await cropFaceToR2(sourceWebKey, opts.bbox, opts.tenantId, opts.personId);
  } else if (opts.source === "uploaded" && opts.uploadedImageBuffer) {
    r2Key = r2Paths.personRefFace(opts.tenantId, opts.personId, randomUUID());
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
 * Upsert (person × every tenant event) = pending into person_event_scans so the
 * matching engine picks them up. Idempotent via unique(person_id, event_id).
 */
export async function enqueueBackfillScans(
  tenantId: string,
  personId: string,
  supabase: ServiceClient,
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

/**
 * Inverse of enqueueBackfillScans: queue (every tenant person × one event) =
 * pending. Called after a sync finishes so newly-synced photos get matched
 * against the whole roster automatically (Goal #3). No-op if the tenant has no
 * people yet. Idempotent via unique(person_id, event_id).
 */
export async function enqueueEventScans(
  tenantId: string,
  eventId: string,
  supabase: ServiceClient,
): Promise<void> {
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

// Person-archive matching engine. Processes pending (person × event) units from
// person_event_scans: for each reference face, SearchFacesByImage against the
// event's Rekognition collection, then index every photo whose indexed face ids
// overlap the matches. Designed to run inside a 60s window and resume (same
// pattern as the photo sync route).

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { downloadFromR2 } from "@/lib/r2";
import { searchFacesByImage } from "@/lib/aws/rekognition";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Matches at/above this similarity are auto-confirmed; below → pending review. */
export const CONFIRMED_THRESHOLD = 90;

export type ScanSummary = {
  unitsProcessed: number;
  photosMatched: number;
  /** true when no pending units remained — the scan is fully drained (done). */
  drained: boolean;
};

/** Highest similarity per faceId across a person's reference-face searches. */
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

/** A scan match is confirmed at/above the threshold, otherwise pending review. */
export function matchStatus(confidence: number): "confirmed" | "pending" {
  return confidence >= CONFIRMED_THRESHOLD ? "confirmed" : "pending";
}

/**
 * Process pending person_event_scans for `tenantId` until `deadlineMs`.
 * One unit at a time (marked `running` so it isn't re-picked); returns drained
 * when none remain. Single-runner model — no atomic claim needed.
 */
export async function scanPendingUnits(
  tenantId: string,
  deadlineMs: number,
): Promise<ScanSummary> {
  const supabase = createServiceRoleClient();
  let unitsProcessed = 0;
  let photosMatched = 0;

  while (Date.now() < deadlineMs) {
    const { data: units } = await supabase
      .from("person_event_scans")
      .select("id, person_id, event_id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit(1);

    const unit = units?.[0];
    if (!unit) return { unitsProcessed, photosMatched, drained: true };

    // Claim it so the next iteration (and concurrent calls) skip it.
    await supabase
      .from("person_event_scans")
      .update({ status: "running", last_run_at: new Date().toISOString() })
      .eq("id", unit.id);

    try {
      const matched = await scanUnit(tenantId, unit.person_id, unit.event_id, supabase);
      await supabase
        .from("person_event_scans")
        .update({ status: "done", photos_matched: matched })
        .eq("id", unit.id);
      photosMatched += matched;
      unitsProcessed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("person_event_scans")
        .update({ status: "error", error: message })
        .eq("id", unit.id);
      console.error(`[people-scan] unit ${unit.id} failed:`, err);
    }
  }

  return { unitsProcessed, photosMatched, drained: false };
}

/** Scan one (person × event) unit; upsert photo_people. Returns photos matched. */
async function scanUnit(
  tenantId: string,
  personId: string,
  eventId: string,
  supabase: ServiceClient,
): Promise<number> {
  const { data: event } = await supabase
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", eventId)
    .single();
  if (!event?.rekognition_collection_id) return 0;

  const { data: refFaces } = await supabase
    .from("person_reference_faces")
    .select("r2_key")
    .eq("person_id", personId);
  if (!refFaces?.length) return 0;

  // Union matches across every reference face of this person.
  const allMatches: Array<{ faceId: string; similarity: number }> = [];
  let calls = 0;
  for (const refFace of refFaces) {
    const imageBuffer = await downloadFromR2(refFace.r2_key);
    if (!imageBuffer) continue;
    try {
      const matches = await searchFacesByImage(
        new Uint8Array(imageBuffer),
        event.rekognition_collection_id,
      );
      allMatches.push(...matches);
      calls++;
    } catch (err) {
      console.warn(`[people-scan] ref face ${refFace.r2_key} search failed:`, err);
    }
  }
  console.log(
    `[people-scan] person=${personId} event=${eventId} rekognition_calls=${calls} matches=${allMatches.length}`,
  );
  if (allMatches.length === 0) return 0;

  const faceToSim = buildFaceToSimilarityMap(allMatches);
  const matchedFaceIds = Array.from(faceToSim.keys());

  // Photos in this event whose indexed face ids overlap the matched set.
  const { data: photos } = await supabase
    .from("photos")
    .select("id, rekognition_face_ids")
    .eq("event_id", eventId)
    .overlaps("rekognition_face_ids", matchedFaceIds);
  if (!photos?.length) return 0;

  const rows = photos.map((photo) => {
    const photoFaceIds = (photo.rekognition_face_ids as string[] | null) ?? [];
    const confidence = Math.max(0, ...photoFaceIds.map((id) => faceToSim.get(id) ?? 0));
    return {
      tenant_id: tenantId,
      person_id: personId,
      photo_id: photo.id,
      event_id: eventId,
      confidence,
      matched_by: "scan" as const,
      status: matchStatus(confidence),
    };
  });

  // ignoreDuplicates: never overwrite an existing row — protects manual/confirmed
  // self-matches from being downgraded by a later scan.
  await supabase
    .from("photo_people")
    .upsert(rows, { onConflict: "person_id,photo_id", ignoreDuplicates: true });

  return photos.length;
}

"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

type MatchedPhoto = { id: string; webUrl: string; fullUrl: string };

export type SearchResult =
  | { ok: true; sessionId: string; photos: MatchedPhoto[] }
  | {
      ok: false;
      reason: "token_expired" | "not_indexed" | "no_face" | "error";
      message: string;
    };

/**
 * Face search server action — called by the guest landing page.
 *
 * Phase 1 stub: Rekognition + R2 storage are skipped when credentials are
 * missing (so the route works before #7 is done). The stub returns an
 * empty match list in that case.
 *
 * Full flow (after #7 + #8):
 *  1. Re-validate share token (still active)
 *  2. Rekognition SearchFacesByImage against the event collection
 *     (throws InvalidParameterException when no face detected → no_face error)
 *  3. Fetch matched photos (visibility="match_only") + public photos and return
 *     R2 URLs. Photos hidden via "ซ่อนบุคคลในภาพ" are excluded by the visibility
 *     filter, so a banned person's photos never reach any guest.
 *  4. Insert guest_session row
 */
export async function searchFaces(formData: FormData): Promise<SearchResult> {
  const token = formData.get("share_token") as string | null;
  const eventId = formData.get("event_id") as string | null;
  const selfieFile = formData.get("selfie") as File | null;

  if (!token || !eventId || !selfieFile || selfieFile.size === 0) {
    return { ok: false, reason: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const supabase = createServiceRoleClient();

  // 1. Re-validate token (always re-check on the server — client state is stale)
  const { data: event } = await supabase
    .from("events")
    .select("id, share_token_expires_at, rekognition_collection_id")
    .eq("id", eventId)
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();

  if (
    !event ||
    !event.share_token_expires_at ||
    new Date(event.share_token_expires_at) <= new Date()
  ) {
    return {
      ok: false,
      reason: "token_expired",
      message: "ลิงก์หมดอายุแล้ว — ติดต่อผู้จัดงานเพื่อขอลิงก์ใหม่",
    };
  }

  // 2. Check if event has been indexed (#7 sets rekognition_collection_id)
  if (!event.rekognition_collection_id) {
    return {
      ok: false,
      reason: "not_indexed",
      message: "งานนี้ยังไม่ได้ sync รูปภาพ — กรุณาติดต่อผู้จัดงาน",
    };
  }

  // 3. Rekognition face search
  const matchResult = await runFaceSearch(
    selfieFile,
    event.rekognition_collection_id,
    eventId,
    supabase,
  );

  if (matchResult === null) {
    return {
      ok: false,
      reason: "no_face",
      message: "ตรวจไม่พบใบหน้าในรูปที่อัพโหลด — กรุณาลองถ่ายใหม่ในที่แสงสว่าง",
    };
  }

  // 4. Fetch matched photos + all public photos for this event
  const photos: MatchedPhoto[] = [];

  const [matchedRows, publicRows] = await Promise.all([
    matchResult.length > 0
      ? supabase
          .from("photos")
          .select("id, r2_web_url, r2_full_url")
          .eq("event_id", eventId)
          .eq("visibility", "match_only")
          .in("id", matchResult)
      : Promise.resolve({ data: [] }),
    supabase
      .from("photos")
      .select("id, r2_web_url, r2_full_url")
      .eq("event_id", eventId)
      .eq("visibility", "public"),
  ]);

  // Merge: matched first, then public (dedup by id)
  const seen = new Set<string>();
  for (const row of [...(matchedRows.data ?? []), ...(publicRows.data ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    photos.push({
      id: row.id,
      webUrl: row.r2_web_url ?? "",
      fullUrl: row.r2_full_url ?? "",
    });
  }

  // 5. Insert guest_session
  const { data: session } = await supabase
    .from("guest_sessions")
    .insert({
      event_id: eventId,
      matched_photo_ids: matchResult,
      expires_at: event.share_token_expires_at,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  return {
    ok: true,
    sessionId: session?.id ?? "",
    photos,
  };
}

/**
 * Rekognition SearchFacesByImage wrapper.
 * Returns null when no face detected in selfie.
 * Returns matched photo IDs (filtered against blacklist).
 * Gracefully stubs when AWS credentials are missing (dev mode).
 */
async function runFaceSearch(
  selfieFile: File,
  collectionId: string,
  eventId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<string[] | null> {
  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    // Dev stub: no credentials → return empty results (not null = "no face")
    console.warn(
      "[face-search] AWS credentials missing — returning stub empty results",
    );
    return [];
  }

  try {
    const { RekognitionClient, SearchFacesByImageCommand } = await import(
      "@aws-sdk/client-rekognition"
    );

    const client = new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const selfieBytes = new Uint8Array(await selfieFile.arrayBuffer());

    const result = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: selfieBytes },
        MaxFaces: 500,
        FaceMatchThreshold: 80,
        QualityFilter: "AUTO",
      }),
    );

    // When there are no matches (but a face was found), FaceMatches is empty array
    const faceIds = (result.FaceMatches ?? [])
      .map((m) => m.Face?.FaceId)
      .filter(Boolean) as string[];

    if (faceIds.length === 0) return [];

    // Look up photos by face_id overlap (rekognition_face_ids is text[]).
    // Hidden photos (e.g. a person hidden via "ซ่อนบุคคลในภาพ") are excluded by the
    // visibility filter in searchFaces(), so no extra face-level filtering is needed.
    const { data: photoRows } = await supabase
      .from("photos")
      .select("id, rekognition_face_ids")
      .eq("event_id", eventId)
      .overlaps("rekognition_face_ids", faceIds);

    return (photoRows ?? []).map((p) => p.id);
  } catch (err: unknown) {
    // InvalidParameterException = Rekognition found no face in the selfie
    if (err instanceof Error && err.name === "InvalidParameterException") {
      return null;
    }
    console.error("[face-search] Rekognition error:", err);
    return [];
  }
}

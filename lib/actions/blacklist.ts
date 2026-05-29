"use server";

import { createClient } from "@/lib/supabase/server";

export type FaceMatchPreview = {
  photoId: string;
  r2_web_url: string;
  matchedFaceId: string;
  bbox: { left: number; top: number; width: number; height: number } | null;
  visibility: string;
};

type FaceDetail = {
  face_id: string;
  bbox: { left: number; top: number; width: number; height: number };
};

/**
 * Find every photo in the event that contains the same person as `sourceFaceId`
 * (via Rekognition similarity search), each with the matched face's bbox for the
 * preview overlay. Used by the gallery "ซ่อนบุคคลในภาพ" flow before hiding them.
 */
export async function findMatchingFacesByFaceId(
  eventId: string,
  sourceFaceId: string,
): Promise<FaceMatchPreview[]> {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", eventId)
    .is("deleted_at", null)
    .single();

  const { searchFacesBySimilarFaceId } = await import("@/lib/aws/rekognition");

  const similar = event?.rekognition_collection_id
    ? await searchFacesBySimilarFaceId(sourceFaceId, event.rekognition_collection_id)
    : [];

  const faceIds = Array.from(new Set([sourceFaceId, ...similar]));
  if (faceIds.length === 0) return [];

  const { data: photos } = await supabase
    .from("photos")
    .select("id, r2_web_url, visibility, face_details, rekognition_face_ids")
    .eq("event_id", eventId)
    .overlaps("rekognition_face_ids", faceIds);

  const previews: FaceMatchPreview[] = [];
  for (const photo of photos ?? []) {
    const details = (photo.face_details ?? []) as FaceDetail[];
    const matched = details.find((f) => faceIds.includes(f.face_id));
    if (!matched) continue;
    previews.push({
      photoId: photo.id,
      r2_web_url: photo.r2_web_url ?? "",
      matchedFaceId: matched.face_id,
      bbox: matched.bbox ?? null,
      visibility: photo.visibility ?? "match_only",
    });
  }

  return previews;
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PhotoVisibility = "public" | "match_only" | "hidden";

/** เปลี่ยน visibility รูปเดี่ยว */
export async function setPhotoVisibility(
  photoId: string,
  eventId: string,
  visibility: PhotoVisibility,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("photos")
    .update({ visibility })
    .eq("id", photoId)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}`);
}

/** เปลี่ยน visibility หลายรูปพร้อมกัน */
export async function setPhotosVisibility(
  photoIds: string[],
  eventId: string,
  visibility: PhotoVisibility,
) {
  if (photoIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("photos")
    .update({ visibility })
    .in("id", photoIds)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/events/${eventId}`);
}

// ── Legacy aliases (compat) ────────────────────────────────────────────────────
export const hidePhoto = async (id: string, eid: string) =>
  setPhotoVisibility(id, eid, "hidden");
export const unhidePhoto = async (id: string, eid: string) =>
  setPhotoVisibility(id, eid, "match_only");
export const hidePhotos = async (ids: string[], eid: string) =>
  setPhotosVisibility(ids, eid, "hidden");
export const unhidePhotos = async (ids: string[], eid: string) =>
  setPhotosVisibility(ids, eid, "match_only");

/** ลบรูปถาวร — ลบจาก DB + R2 */
export async function deletePhoto(photoId: string, eventId: string) {
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  // ดึง R2 keys + face_ids ก่อนลบ
  const { data: photo } = await supabase
    .from("photos")
    .select("r2_web_url, r2_full_url, rekognition_face_ids")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .single();

  // ลบจาก DB
  const { error } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);

  // ลบจาก R2 (best-effort)
  if (photo?.r2_web_url || photo?.r2_full_url) {
    try {
      const { DeleteObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
      const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
      const BUCKET = process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME ?? "";
      const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

      if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && BUCKET) {
        const client = new S3Client({
          region: "auto",
          endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
        });

        const toKey = (url: string | null) =>
          url && PUBLIC_URL ? url.replace(`${PUBLIC_URL}/`, "") : null;

        const keys = [toKey(photo.r2_web_url), toKey(photo.r2_full_url)].filter(Boolean) as string[];
        await Promise.allSettled(
          keys.map((k) => client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: k }))),
        );
      }
    } catch {
      console.warn(`[deletePhoto] R2 cleanup failed for photo ${photoId}`);
    }
  }

  // ลบ face_blacklist entries (best-effort)
  const faceIds: string[] = photo?.rekognition_face_ids ?? [];
  if (faceIds.length > 0) {
    await admin
      .from("face_blacklist")
      .delete()
      .eq("event_id", eventId)
      .in("face_id", faceIds);
  }

  revalidatePath(`/dashboard/events/${eventId}`);
}

/** ลบหลายรูปถาวร */
export async function deletePhotos(photoIds: string[], eventId: string) {
  if (photoIds.length === 0) return;
  for (const id of photoIds) {
    await deletePhoto(id, eventId);
  }
}

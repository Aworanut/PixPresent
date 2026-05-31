"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { matchedVisibilities } from "@/lib/face-search-visibility";

/**
 * Liveness face-search server actions — the ONLY door for `liveness_required`
 * events (the ordinary upload path in `face-search.ts` fails closed for them).
 * See docs/adr/0002-liveness-restricted-distribution.md.
 *
 * Two-step flow, driven by the (not-yet-built) AWS Amplify liveness component:
 *   1. createLivenessSession() → returns an AWS Face Liveness SessionId. The
 *      browser runs the live scan against that session using guest-scoped AWS
 *      credentials (Cognito identity pool — also not yet wired).
 *   2. searchByLiveness(sessionId) → verifies the scan succeeded, then searches
 *      the event collection with the session's REFERENCE IMAGE (never a
 *      guest-supplied file — that binding is the entire security property) and
 *      returns photos across public + match_only + `hidden`.
 *
 * Status: backend ready, but NOT integration-testable until the Amplify
 * frontend + Cognito are in place. Without AWS credentials these actions stub
 * to `unavailable` rather than pretending to work.
 */

type MatchedPhoto = { id: string; webUrl: string; fullUrl: string };

const FACE_MATCH_THRESHOLD = 80;
// AWS Face Liveness Confidence is 0–100. 85 is a reasonable production floor;
// tune against real-world pilot results.
const LIVENESS_CONFIDENCE_THRESHOLD = 85;

type LivenessEvent = {
  id: string;
  // Non-null: loadLivenessEvent returns token_expired before this is populated.
  share_token_expires_at: string;
  rekognition_collection_id: string;
};

type EventError = {
  reason: "token_expired" | "not_liveness_event" | "not_indexed";
  message: string;
};

export type CreateLivenessSessionResult =
  | { ok: true; sessionId: string }
  | {
      ok: false;
      reason: EventError["reason"] | "unavailable" | "error";
      message: string;
    };

export type LivenessSearchResult =
  | { ok: true; sessionId: string; photos: MatchedPhoto[] }
  | {
      ok: false;
      reason:
        | EventError["reason"]
        | "liveness_failed"
        | "no_face"
        | "unavailable"
        | "error";
      message: string;
    };

/**
 * Re-validate the share token AND that this is genuinely a liveness event.
 * The liveness path may read `hidden`, so it must refuse to run on a
 * non-liveness event — the mirror of `searchFaces`' fail-closed guard.
 */
async function loadLivenessEvent(
  token: string,
  eventId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<{ event: LivenessEvent } | { error: EventError }> {
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, share_token_expires_at, rekognition_collection_id, liveness_required",
    )
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
      error: {
        reason: "token_expired",
        message: "ลิงก์หมดอายุแล้ว — ติดต่อผู้จัดงานเพื่อขอลิงก์ใหม่",
      },
    };
  }

  if (!event.liveness_required) {
    return {
      error: {
        reason: "not_liveness_event",
        message: "งานนี้ไม่ได้เปิดการยืนยันตัวตนด้วยการสแกนใบหน้าสด",
      },
    };
  }

  if (!event.rekognition_collection_id) {
    return {
      error: {
        reason: "not_indexed",
        message: "งานนี้ยังไม่ได้ sync รูปภาพ — กรุณาติดต่อผู้จัดงาน",
      },
    };
  }

  return {
    event: {
      id: event.id,
      share_token_expires_at: event.share_token_expires_at,
      rekognition_collection_id: event.rekognition_collection_id,
    },
  };
}

function hasAwsCredentials(): boolean {
  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
  return !!(AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

async function rekognitionClient() {
  const { RekognitionClient } = await import("@aws-sdk/client-rekognition");
  return new RekognitionClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/** Step 1: start an AWS Face Liveness session for the browser to run the scan. */
export async function createLivenessSession(
  eventId: string,
  token: string,
): Promise<CreateLivenessSessionResult> {
  if (!token || !eventId) {
    return { ok: false, reason: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const supabase = createServiceRoleClient();
  const loaded = await loadLivenessEvent(token, eventId, supabase);
  if ("error" in loaded) return { ok: false, ...loaded.error };

  if (!hasAwsCredentials()) {
    return {
      ok: false,
      reason: "unavailable",
      message: "ระบบสแกนใบหน้าสดยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า AWS)",
    };
  }

  try {
    const { CreateFaceLivenessSessionCommand } = await import(
      "@aws-sdk/client-rekognition"
    );
    const client = await rekognitionClient();
    const res = await client.send(new CreateFaceLivenessSessionCommand({}));

    if (!res.SessionId) {
      return { ok: false, reason: "error", message: "สร้าง session ไม่สำเร็จ" };
    }
    return { ok: true, sessionId: res.SessionId };
  } catch (err) {
    console.error("[liveness] create session error:", err);
    return {
      ok: false,
      reason: "error",
      message: "เกิดข้อผิดพลาดในการเริ่มการสแกน",
    };
  }
}

/** Step 2: verify the scan, then search with its reference image. */
export async function searchByLiveness(
  eventId: string,
  token: string,
  sessionId: string,
): Promise<LivenessSearchResult> {
  if (!token || !eventId || !sessionId) {
    return { ok: false, reason: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const supabase = createServiceRoleClient();
  const loaded = await loadLivenessEvent(token, eventId, supabase);
  if ("error" in loaded) return { ok: false, ...loaded.error };
  const event = loaded.event;

  if (!hasAwsCredentials()) {
    return {
      ok: false,
      reason: "unavailable",
      message: "ระบบสแกนใบหน้าสดยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า AWS)",
    };
  }

  // 1. Confirm the live scan succeeded and grab its reference image.
  let referenceBytes: Uint8Array;
  try {
    const { GetFaceLivenessSessionResultsCommand } = await import(
      "@aws-sdk/client-rekognition"
    );
    const client = await rekognitionClient();
    const res = await client.send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
    );

    const passed =
      res.Status === "SUCCEEDED" &&
      (res.Confidence ?? 0) >= LIVENESS_CONFIDENCE_THRESHOLD;

    if (!passed) {
      return {
        ok: false,
        reason: "liveness_failed",
        message:
          "ยืนยันใบหน้าสดไม่สำเร็จ — กรุณาสแกนใหม่ในที่แสงสว่างและมองกล้องตรงๆ",
      };
    }

    const bytes = res.ReferenceImage?.Bytes;
    if (!bytes) {
      return {
        ok: false,
        reason: "error",
        message: "ไม่พบภาพอ้างอิงจากการสแกน",
      };
    }
    referenceBytes = bytes;
  } catch (err) {
    console.error("[liveness] get results error:", err);
    return {
      ok: false,
      reason: "error",
      message: "เกิดข้อผิดพลาดในการตรวจผลการสแกน",
    };
  }

  // 2. Search the collection with the LIVENESS reference image (never a guest file).
  const matchResult = await runReferenceImageSearch(
    referenceBytes,
    event.rekognition_collection_id,
    eventId,
    supabase,
  );

  if (matchResult === null) {
    return {
      ok: false,
      reason: "no_face",
      message: "ตรวจไม่พบใบหน้าจากการสแกน — กรุณาลองใหม่",
    };
  }

  // 3. Liveness path reads match_only + `hidden` (the restricted subset) for
  //    matches, plus all public photos. (ADR 0002 — `hidden` is reachable here
  //    and ONLY here.)
  const photos: MatchedPhoto[] = [];
  const [matchedRows, publicRows] = await Promise.all([
    matchResult.length > 0
      ? supabase
          .from("photos")
          .select("id, r2_web_url, r2_full_url")
          .eq("event_id", eventId)
          .in("visibility", matchedVisibilities("liveness"))
          .in("id", matchResult)
      : Promise.resolve({ data: [] }),
    supabase
      .from("photos")
      .select("id, r2_web_url, r2_full_url")
      .eq("event_id", eventId)
      .eq("visibility", "public"),
  ]);

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

  // 4. Log the guest session (PDPA consent is implicit in completing a live scan).
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

  return { ok: true, sessionId: session?.id ?? "", photos };
}

/**
 * SearchFacesByImage with raw bytes (the liveness reference image).
 * Returns null when no face is detected, else matched photo IDs.
 */
async function runReferenceImageSearch(
  imageBytes: Uint8Array,
  collectionId: string,
  eventId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<string[] | null> {
  try {
    const { SearchFacesByImageCommand } = await import(
      "@aws-sdk/client-rekognition"
    );
    const client = await rekognitionClient();

    const result = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBytes },
        MaxFaces: 500,
        FaceMatchThreshold: FACE_MATCH_THRESHOLD,
        QualityFilter: "AUTO",
      }),
    );

    const faceIds = (result.FaceMatches ?? [])
      .map((m) => m.Face?.FaceId)
      .filter(Boolean) as string[];

    if (faceIds.length === 0) return [];

    const { data: photoRows } = await supabase
      .from("photos")
      .select("id, rekognition_face_ids")
      .eq("event_id", eventId)
      .overlaps("rekognition_face_ids", faceIds);

    return (photoRows ?? []).map((p) => p.id);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "InvalidParameterException") {
      return null;
    }
    console.error("[liveness] reference image search error:", err);
    return [];
  }
}

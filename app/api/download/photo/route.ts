/**
 * GET /api/download/photo?id=photoId&token=shareToken
 *
 * Streams a single web-optimized photo from R2 after share-token validation.
 */

import { type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  contentDispositionAttachment,
  downloadPhotoFilename,
} from "@/lib/download-filename";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const token = request.nextUrl.searchParams.get("token");

  if (!id || !token) {
    return new Response("Missing id or token", { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, share_token_expires_at")
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();

  if (
    !event ||
    !event.share_token_expires_at ||
    new Date(event.share_token_expires_at) <= new Date()
  ) {
    return new Response("Link expired", { status: 403 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("id, r2_web_url, original_filename")
    .eq("id", id)
    .eq("event_id", event.id)
    .not("r2_web_url", "is", null)
    .maybeSingle();

  if (!photo?.r2_web_url) {
    return new Response("Photo not found", { status: 404 });
  }

  const upstream = await fetch(photo.r2_web_url);
  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to fetch photo", { status: 502 });
  }

  const filename = downloadPhotoFilename(
    photo.original_filename,
    `photo-${photo.id.slice(0, 8)}`,
  );

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "no-store",
    },
  });
}

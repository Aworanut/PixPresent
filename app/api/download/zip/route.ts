/**
 * GET /api/download/zip?ids=id1,id2,...&token=shareToken
 *
 * Streams a ZIP of web-optimized photos fetched from R2.
 * Validates the share token before serving.
 */

import { type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { uniqueDownloadFilenames } from "@/lib/download-filename";
import { Zip, ZipPassThrough } from "fflate";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  const token = request.nextUrl.searchParams.get("token");

  if (!ids || !token) {
    return new Response("Missing ids or token", { status: 400 });
  }

  const photoIds = ids.split(",").filter(Boolean).slice(0, 200); // cap at 200
  if (photoIds.length === 0) {
    return new Response("No photo IDs", { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Validate token
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

  // Fetch photo URLs
  const { data: photos } = await supabase
    .from("photos")
    .select("id, r2_web_url, original_filename")
    .in("id", photoIds)
    .eq("event_id", event.id)
    .not("r2_web_url", "is", null);

  if (!photos || photos.length === 0) {
    return new Response("No photos found", { status: 404 });
  }

  const filenames = uniqueDownloadFilenames(
    photos.map((photo, i) => ({
      originalFilename: photo.original_filename,
      fallbackStem: `photo-${String(i + 1).padStart(3, "0")}`,
    })),
  );

  // Stream ZIP
  const stream = new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (!photo.r2_web_url) continue;

        try {
          const res = await fetch(photo.r2_web_url);
          if (!res.ok || !res.body) continue;

          const filename = filenames[i];
          const passThrough = new ZipPassThrough(filename);
          zip.add(passThrough);

          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            passThrough.push(value, false);
          }
          passThrough.push(new Uint8Array(0), true);
        } catch {
          // skip failed photo, continue
        }
      }

      zip.end();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="photos.zip"',
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST /api/events/[id]/sync
 *
 * Streams sync progress as Server-Sent Events (SSE).
 * The client subscribes and receives:
 *   { type: 'progress', folder: string, done: number, total: number }
 *   { type: 'done', photoCount: number }
 *   { type: 'error', message: string }
 *
 * Auth: organizer must own the event (verified via RLS query).
 *
 * Full flow (requires #2 credentials):
 *  1. Verify organizer owns the event
 *  2. Get Drive refresh token from tenant
 *  3. For each folder in event_storage_folders:
 *     a. List images
 *     b. Skip already-indexed (storage_file_id in photos)
 *     c. Download → resize → upload to R2 → IndexFaces → insert photo row
 *  4. Update events.sync_completed_at + is_indexed = true
 *
 * Graceful stubs when env vars are missing (dev mode).
 */

import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SourceType, SourceFile, StorageProvider } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;

  // 1. Auth check — use user Supabase client so RLS applies
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Verify event belongs to this organizer + get tenant info
  const admin = createServiceRoleClient();

  const { data: event } = await admin
    .from("events")
    .select("id, name, rekognition_collection_id, tenant_id, storage_limit_gb, tier")
    .eq("id", eventId)
    .is("deleted_at", null)
    .single();

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  // Verify ownership via tenant
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, owner_user_id, google_refresh_token, dropbox_refresh_token")
    .eq("id", event.tenant_id)
    .single();

  if (!tenant || tenant.owner_user_id !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // 3. Get folder list
  const { data: folders } = await admin
    .from("event_storage_folders")
    .select("id, label, folder_id, source_type")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (!folders || folders.length === 0) {
    return new Response("No folders configured for this event", { status: 400 });
  }

  // 4. Mark sync started
  await admin
    .from("events")
    .update({ sync_started_at: new Date().toISOString(), sync_completed_at: null })
    .eq("id", eventId);

  // 5. SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        // Don't write to a closed/cancelled stream
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // controller already closed (client disconnected)
        }
      };

      try {
        const result = await runSync({
          eventId,
          folders: folders as Folder[],
          tenantId: tenant.id,
          googleRefreshToken: tenant.google_refresh_token,
          dropboxRefreshToken: tenant.dropbox_refresh_token,
          admin,
          send,
          signal: request.signal,  // propagate abort signal into the loop
          storageLimitGb: event.storage_limit_gb ?? 5,
          tier: event.tier ?? "starter",
        });

        // Mark sync complete (partial or full)
        await admin
          .from("events")
          .update({
            sync_completed_at: new Date().toISOString(),
            sync_photo_count: result.totalPhotos,
            is_indexed: result.totalPhotos > 0,
          })
          .eq("id", eventId);

        if (result.exceeded) {
          send({
            type: "storage_exceeded",
            photoCount: result.totalPhotos,
            usedGb: result.usedGb,
            limitGb: result.limitGb,
            tier: result.tier,
            nextTier: result.nextTier,
          });
        } else {
          send({ type: "done", photoCount: result.totalPhotos });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Client disconnected — exit cleanly without sending error
          return;
        }
        console.error("[sync] Unhandled error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx: disable buffering
    },
  });
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

type Folder = { id: string; label: string | null; folder_id: string; source_type: SourceType };
type SendFn = (data: Record<string, unknown>) => void;
type NextTier = { label: string; limitGb: number };

const NEXT_TIER: Record<string, NextTier | null> = {
  starter: { label: "Gallery", limitGb: 20 },
  gallery: { label: "Studio", limitGb: 50 },
  studio: null,
};

type SyncResult =
  | { exceeded: false; totalPhotos: number }
  | { exceeded: true; totalPhotos: number; usedGb: number; limitGb: number; tier: string; nextTier: NextTier | null };

async function runSync({
  eventId,
  folders,
  googleRefreshToken,
  dropboxRefreshToken,
  admin,
  send,
  signal,
  storageLimitGb,
  tier,
}: {
  eventId: string;
  folders: Folder[];
  tenantId: string;
  googleRefreshToken: string | null;
  dropboxRefreshToken: string | null;
  admin: ReturnType<typeof createServiceRoleClient>;
  send: SendFn;
  signal: AbortSignal;
  storageLimitGb: number;
  tier: string;
}): Promise<SyncResult> {
  const { getProvider } = await import("@/lib/storage");
  const hasAWS =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasR2 =
    !!process.env.R2_ACCESS_KEY_ID &&
    !!(process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME);

  // Ensure Rekognition collection exists for this event
  const collectionId = await ensureRekognitionCollection(eventId, admin);

  // Fetch current storage usage for this event
  const storageLimitBytes = storageLimitGb * 1024 * 1024 * 1024;
  const { data: storageData } = await admin
    .from("photos")
    .select("storage_bytes")
    .eq("event_id", eventId);
  let currentStorageBytes = (storageData ?? []).reduce(
    (sum, p) => sum + ((p as unknown as { storage_bytes: number }).storage_bytes ?? 0),
    0,
  );

  let totalProcessed = 0;
  let storageExceeded = false;

  for (const folder of folders) {
    if (storageExceeded) break;
    const folderLabel = folder.label ?? folder.folder_id;

    // Resolve the provider for this folder's source. Skip (with a warning)
    // if the tenant hasn't connected that provider — mirrors stub-skip.
    let provider: StorageProvider;
    try {
      provider = await getProvider(folder.source_type, {
        googleRefreshToken,
        dropboxRefreshToken,
      });
    } catch (err) {
      send({
        type: "warn",
        message: `${folderLabel}: ${err instanceof Error ? err.message : "provider unavailable"} — skipped`,
      });
      send({ type: "progress", folder: folderLabel, done: 0, total: 0, stub: true });
      continue;
    }

    send({ type: "progress", folder: folderLabel, done: 0, total: -1, phase: "listing" });

    // List images in this folder
    const sourceFiles = await provider.listImages(folder.folder_id);

    send({
      type: "progress",
      folder: folderLabel,
      done: 0,
      total: sourceFiles.length,
      phase: "syncing",
    });

    // Load already-indexed file IDs + R2 URL status
    const { data: existingPhotos } = await admin
      .from("photos")
      .select("id, storage_file_id, r2_web_url")
      .eq("event_id", eventId);

    // Fully done: indexed + has R2 URL → skip entirely
    const doneSet = new Set(
      (existingPhotos ?? [])
        .filter((p) => p.r2_web_url)
        .map((p) => p.storage_file_id),
    );
    // Partially done: indexed but missing R2 URL → re-upload only (no Rekognition)
    const needsUrlMap = new Map(
      (existingPhotos ?? [])
        .filter((p) => !p.r2_web_url)
        .map((p) => [p.storage_file_id, p.id]),
    );

    let doneFolderCount = 0;

    for (const file of sourceFiles) {
      // Check if client cancelled — stop immediately
      signal.throwIfAborted();

      if (doneSet.has(file.id)) {
        doneFolderCount++;
        send({
          type: "progress",
          folder: folderLabel,
          done: doneFolderCount,
          total: sourceFiles.length,
          skipped: true,
        });
        continue;
      }

      try {
        if (needsUrlMap.has(file.id)) {
          // Already indexed — only backfill R2 URLs (skip Rekognition)
          await backfillR2Url({
            file,
            existingPhotoId: needsUrlMap.get(file.id)!,
            eventId,
            provider,
            admin,
            hasR2,
            folderDbId: folder.id,
            folderLabel,
          });
          // backfill ไม่ใช่รูปใหม่ — ไม่นับเข้า totalProcessed
        } else {
          // New file — full process: download → resize → quota check → R2 → Rekognition
          const result = await processOnePhoto({
            file,
            eventId,
            collectionId,
            provider,
            admin,
            hasR2,
            hasAWS,
            folderDbId: folder.id,
            folderLabel,
            storageLimitBytes,
            currentStorageBytes,
          });
          if (result.exceeded) {
            storageExceeded = true;
            break; // stop this folder; outer loop will also break
          }
          currentStorageBytes += result.storageBytes;
          totalProcessed++; // นับเฉพาะรูปใหม่จริงๆ
        }

        doneFolderCount++;
        send({
          type: "progress",
          folder: folderLabel,
          done: doneFolderCount,
          total: sourceFiles.length,
        });
      } catch (err) {
        // Log but don't abort the whole sync on single-file error
        console.error(`[sync] Failed to process file ${file.id}:`, err);
        send({
          type: "file_error",
          folder: folderLabel,
          fileId: file.id,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        doneFolderCount++;
      }
    }
  }

  if (storageExceeded) {
    const usedGb = Math.round((currentStorageBytes / 1024 / 1024 / 1024) * 100) / 100;
    return {
      exceeded: true,
      totalPhotos: totalProcessed,
      usedGb,
      limitGb: storageLimitGb,
      tier,
      nextTier: NEXT_TIER[tier] ?? null,
    };
  }

  return { exceeded: false, totalPhotos: totalProcessed };
}

/** Backfill R2 URLs for photos that were indexed but never uploaded to R2. */
async function backfillR2Url({
  file,
  existingPhotoId,
  eventId,
  provider,
  admin,
  hasR2,
  folderDbId,
}: {
  file: SourceFile;
  existingPhotoId: string;
  eventId: string;
  provider: StorageProvider;
  admin: ReturnType<typeof createServiceRoleClient>;
  hasR2: boolean;
  folderDbId: string;
  folderLabel: string;
}): Promise<void> {
  if (!hasR2) return;

  const original = await provider.downloadFile(file.id);

  const { processImage } = await import("@/lib/image-processing");
  const exif = await processImage(original);
  const { web, full } = exif;

  const { uploadToR2, r2Paths } = await import("@/lib/r2");
  const webKey = r2Paths.photoWeb(eventId, existingPhotoId);
  const fullKey = r2Paths.photoFull(eventId, existingPhotoId);

  const [webUpload, fullUpload] = await Promise.all([
    uploadToR2(webKey, web, "image/jpeg"),
    uploadToR2(fullKey, full, "image/jpeg"),
  ]);

  await admin
    .from("photos")
    .update({
      r2_web_url: webUpload.ok ? webUpload.url : null,
      r2_full_url: fullUpload.ok ? fullUpload.url : null,
      original_filename: file.name,
      taken_at: exif.takenAt || file.modifiedTime || new Date().toISOString(),
      photographer_name: exif.artist || null,
      copyright: exif.copyright || null,
      event_storage_folder_id: folderDbId,
      storage_bytes: web.length + full.length,
    })
    .eq("id", existingPhotoId);
}

async function processOnePhoto({
  file,
  eventId,
  collectionId,
  provider,
  admin,
  hasR2,
  hasAWS,
  folderDbId,
  storageLimitBytes,
  currentStorageBytes,
}: {
  file: SourceFile;
  eventId: string;
  collectionId: string;
  provider: StorageProvider;
  admin: ReturnType<typeof createServiceRoleClient>;
  hasR2: boolean;
  hasAWS: boolean;
  folderDbId: string;
  folderLabel: string;
  storageLimitBytes: number;
  currentStorageBytes: number;
}): Promise<{ exceeded: false; storageBytes: number } | { exceeded: true }> {
  // 1. Download original from the source provider (provider handles its own retry)
  const original = await provider.downloadFile(file.id);

  // 2. Resize into web + full variants
  const { processImage } = await import("@/lib/image-processing");
  const exif = await processImage(original);
  const { web, full } = exif;

  // 3. Quota check — after processing (sizes known), before uploading
  const storageBytes = web.length + full.length;
  if (currentStorageBytes + storageBytes > storageLimitBytes) {
    return { exceeded: true };
  }

  // 3. Generate a photo ID
  const photoId = crypto.randomUUID();

  // 4. Upload to R2
  let webUrl: string | null = null;
  let fullUrl: string | null = null;

  if (hasR2) {
    const { uploadToR2, r2Paths } = await import("@/lib/r2");

    const webKey = r2Paths.photoWeb(eventId, photoId);
    const fullKey = r2Paths.photoFull(eventId, photoId);

    const [webUpload, fullUpload] = await Promise.all([
      uploadToR2(webKey, web, "image/jpeg"),
      uploadToR2(fullKey, full, "image/jpeg"),
    ]);

    webUrl = webUpload.ok ? webUpload.url : null;
    fullUrl = fullUpload.ok ? fullUpload.url : null;
  }

  // 5. Rekognition IndexFaces
  const faceIds: string[] = [];
  type FaceDetail = { face_id: string; bbox: { left: number; top: number; width: number; height: number } };
  const faceDetails: FaceDetail[] = [];

  if (hasAWS && collectionId) {
    const { RekognitionClient, IndexFacesCommand } = await import(
      "@aws-sdk/client-rekognition"
    );

    const client = new RekognitionClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const indexResult = await client.send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: new Uint8Array(web) },
        ExternalImageId: photoId,
        MaxFaces: 20,
        QualityFilter: "AUTO",
        DetectionAttributes: ["DEFAULT"],
      }),
    );

    for (const fr of indexResult.FaceRecords ?? []) {
      const faceId = fr.Face?.FaceId;
      const bb = fr.Face?.BoundingBox;
      if (faceId) {
        faceIds.push(faceId);
        if (bb?.Left != null && bb?.Top != null && bb?.Width != null && bb?.Height != null) {
          faceDetails.push({
            face_id: faceId,
            bbox: { left: bb.Left, top: bb.Top, width: bb.Width, height: bb.Height },
          });
        }
      }
    }
  }

  // 6. Insert photo row
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
  });

  return { exceeded: false, storageBytes };
}

/** Ensure the Rekognition collection exists; create if missing. */
async function ensureRekognitionCollection(
  eventId: string,
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<string> {
  const { data: event } = await admin
    .from("events")
    .select("rekognition_collection_id")
    .eq("id", eventId)
    .single();

  if (event?.rekognition_collection_id) {
    return event.rekognition_collection_id;
  }

  if (!process.env.AWS_ACCESS_KEY_ID) {
    // No AWS — use event ID as stub collection ID
    return `stub-${eventId}`;
  }

  const { RekognitionClient, CreateCollectionCommand } = await import(
    "@aws-sdk/client-rekognition"
  );

  const collectionId = `facefind-event-${eventId}`;
  const client = new RekognitionClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // CreateCollection is idempotent-ish; ResourceInUseException = already exists
  try {
    await client.send(
      new CreateCollectionCommand({ CollectionId: collectionId }),
    );
  } catch (err: unknown) {
    if (
      !(err instanceof Error && err.name === "ResourceInUseException")
    ) {
      throw err;
    }
  }

  await admin
    .from("events")
    .update({ rekognition_collection_id: collectionId })
    .eq("id", eventId);

  return collectionId;
}


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
import { processImage } from "@/lib/image-processing";
import { uploadToR2, r2Paths } from "@/lib/r2";
import type { SourceType, SourceFile, StorageProvider } from "@/lib/storage";
import type { RekognitionClient } from "@aws-sdk/client-rekognition";
import { enqueueEventScans } from "@/lib/people/enrollment";

// Hobby plan caps serverless functions at 60s. Each invocation syncs as many
// photos as fit in the window; the client re-runs to resume (already-done files
// are skipped via doneSet) until the folder is fully indexed.
export const maxDuration = 60;

// Photos processed concurrently within a folder. Each photo is mostly network
// wait (download → R2 → Rekognition), so a small pool gives a near-linear
// speedup without exhausting memory or tripping provider rate limits.
// Override via SYNC_CONCURRENCY.
const SYNC_CONCURRENCY = Math.max(1, Number(process.env.SYNC_CONCURRENCY) || 5);

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
          // Auto-incremental (#27): queue every roster person against this event
          // so newly-synced photos get matched without a manual rescan. Best-effort.
          await enqueueEventScans(tenant.id, eventId, admin).catch((err) =>
            console.error("[sync] enqueueEventScans failed:", err),
          );
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

  // Hoist the Rekognition client + command out of the per-photo loop so a single
  // TLS/connection pool is reused across every photo (and every worker), instead
  // of constructing a fresh client per image as the old serial loop did.
  let rekognition: RekognitionClient | null = null;
  let IndexFacesCommand:
    | typeof import("@aws-sdk/client-rekognition").IndexFacesCommand
    | null = null;
  if (hasAWS && collectionId && !collectionId.startsWith("stub-")) {
    const mod = await import("@aws-sdk/client-rekognition");
    IndexFacesCommand = mod.IndexFacesCommand;
    rekognition = new mod.RekognitionClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // Per-step timing accumulators — one per folder (logged after each folder)
  // plus a running total for the whole sync. Gives a baseline measurement of
  // where the wall-clock actually goes (download vs sharp vs Rekognition).
  const perfTotal = newPerf();

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

    // Load already-indexed file IDs + R2 URL status + folder_path
    const { data: existingPhotos } = await admin
      .from("photos")
      .select("id, storage_file_id, r2_web_url, folder_path")
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
    // file id → existing row, used to backfill folder_path on re-sync without
    // re-downloading (paths were '' before recursive listing existed).
    const existingById = new Map(
      (existingPhotos ?? []).map((p) => [p.storage_file_id, p]),
    );

    let doneFolderCount = 0;
    const perf = newPerf();

    // Atomically reserve storage against the event quota. The check + increment
    // runs in a single synchronous tick (no await between read and write), so
    // two concurrent workers can never both slip past the limit.
    const reserveStorage = (bytes: number): boolean => {
      if (currentStorageBytes + bytes > storageLimitBytes) return false;
      currentStorageBytes += bytes;
      return true;
    };

    // Process one source file: skip / backfill / full index. Shared across the
    // worker pool — every shared counter is mutated only in synchronous tails.
    const handleFile = async (file: SourceFile): Promise<void> => {
      signal.throwIfAborted();
      if (storageExceeded) return;

      if (doneSet.has(file.id)) {
        // Backfill folder_path on re-sync without re-downloading (paths were ''
        // before recursive listing). Only writes when it actually changed.
        const existing = existingById.get(file.id);
        const newPath = file.relativePath ?? "";
        if (existing && existing.folder_path !== newPath) {
          await admin.from("photos").update({ folder_path: newPath }).eq("id", existing.id);
        }
        doneFolderCount++;
        send({
          type: "progress",
          folder: folderLabel,
          done: doneFolderCount,
          total: sourceFiles.length,
          skipped: true,
        });
        return;
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
            rekognition,
            IndexFacesCommand,
            folderDbId: folder.id,
            folderLabel,
            reserveStorage,
            perf,
          });
          if (result.exceeded) {
            storageExceeded = true; // stop spawning new work in this + outer loop
            return;
          }
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
        // Abort propagates out of the pool so the route can exit cleanly.
        if ((err as Error).name === "AbortError") throw err;
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
    };

    await runPool(sourceFiles, SYNC_CONCURRENCY, handleFile, () => storageExceeded);

    logPerf(folderLabel, perf);
    mergePerf(perfTotal, perf);
  }

  logPerf("ALL", perfTotal);

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

// ─── Concurrency + timing helpers ──────────────────────────────────────────────

type Perf = {
  count: number;
  downloadMs: number;
  processMs: number;
  uploadMs: number;
  rekognitionMs: number;
  insertMs: number;
};

function newPerf(): Perf {
  return { count: 0, downloadMs: 0, processMs: 0, uploadMs: 0, rekognitionMs: 0, insertMs: 0 };
}

function mergePerf(into: Perf, from: Perf): void {
  into.count += from.count;
  into.downloadMs += from.downloadMs;
  into.processMs += from.processMs;
  into.uploadMs += from.uploadMs;
  into.rekognitionMs += from.rekognitionMs;
  into.insertMs += from.insertMs;
}

/** Log average + total wall-clock per pipeline step. Skips empty accumulators. */
function logPerf(label: string, p: Perf): void {
  if (p.count === 0) return;
  const avg = (ms: number) => (ms / p.count).toFixed(0);
  const tot = (ms: number) => (ms / 1000).toFixed(1);
  console.log(
    `[sync-perf] ${label}: ${p.count} new photos | ` +
      `avg/photo download=${avg(p.downloadMs)}ms process=${avg(p.processMs)}ms ` +
      `upload=${avg(p.uploadMs)}ms rekognition=${avg(p.rekognitionMs)}ms insert=${avg(p.insertMs)}ms | ` +
      `totals download=${tot(p.downloadMs)}s process=${tot(p.processMs)}s ` +
      `upload=${tot(p.uploadMs)}s rekognition=${tot(p.rekognitionMs)}s insert=${tot(p.insertMs)}s`,
  );
}

/**
 * Run `fn` over `items` with at most `limit` concurrent executions. A sliding
 * worker pool (not fixed batches), so one slow photo never stalls the rest.
 * `shouldStop` is polled before each task to bail out early (quota exceeded).
 * If `fn` rejects (e.g. AbortError) the rejection propagates and the pool stops.
 */
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<void> {
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < items.length) {
      if (shouldStop()) return;
      await fn(items[i++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
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

  const exif = await processImage(original);
  const { web, full } = exif;

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
      folder_path: file.relativePath ?? "",
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
  rekognition,
  IndexFacesCommand,
  folderDbId,
  reserveStorage,
  perf,
}: {
  file: SourceFile;
  eventId: string;
  collectionId: string;
  provider: StorageProvider;
  admin: ReturnType<typeof createServiceRoleClient>;
  hasR2: boolean;
  rekognition: RekognitionClient | null;
  IndexFacesCommand:
    | typeof import("@aws-sdk/client-rekognition").IndexFacesCommand
    | null;
  folderDbId: string;
  folderLabel: string;
  reserveStorage: (bytes: number) => boolean;
  perf: Perf;
}): Promise<{ exceeded: false; storageBytes: number } | { exceeded: true }> {
  // 1. Download original from the source provider (provider handles its own retry)
  const tDl = performance.now();
  const original = await provider.downloadFile(file.id);
  perf.downloadMs += performance.now() - tDl;

  // 2. Resize into web + full variants
  const tProc = performance.now();
  const exif = await processImage(original);
  perf.processMs += performance.now() - tProc;
  const { web, full } = exif;

  // 3. Quota — atomically reserve before any upload (over-limit → stop)
  const storageBytes = web.length + full.length;
  if (!reserveStorage(storageBytes)) {
    return { exceeded: true };
  }

  const photoId = crypto.randomUUID();

  // 4. Upload to R2 (web + full in parallel)
  let webUrl: string | null = null;
  let fullUrl: string | null = null;

  if (hasR2) {
    const tUp = performance.now();
    const webKey = r2Paths.photoWeb(eventId, photoId);
    const fullKey = r2Paths.photoFull(eventId, photoId);

    const [webUpload, fullUpload] = await Promise.all([
      uploadToR2(webKey, web, "image/jpeg"),
      uploadToR2(fullKey, full, "image/jpeg"),
    ]);
    perf.uploadMs += performance.now() - tUp;

    webUrl = webUpload.ok ? webUpload.url : null;
    fullUrl = fullUpload.ok ? fullUpload.url : null;
  }

  // 5. Rekognition IndexFaces (shared client, hoisted out of the loop)
  const faceIds: string[] = [];
  type FaceDetail = { face_id: string; bbox: { left: number; top: number; width: number; height: number } };
  const faceDetails: FaceDetail[] = [];

  if (rekognition && IndexFacesCommand && collectionId) {
    const tRek = performance.now();
    const indexResult = await rekognition.send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: new Uint8Array(web) },
        ExternalImageId: photoId,
        MaxFaces: 20,
        QualityFilter: "AUTO",
        DetectionAttributes: ["DEFAULT"],
      }),
    );
    perf.rekognitionMs += performance.now() - tRek;

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
  const tIns = performance.now();
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
    folder_path: file.relativePath ?? "",
  });
  perf.insertMs += performance.now() - tIns;
  perf.count++;

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


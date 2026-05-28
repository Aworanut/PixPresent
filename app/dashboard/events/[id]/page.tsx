import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buttonVariants } from "@/components/ui/button";
import { DeleteEventButton } from "./_delete-button";
import { EventToolbar } from "./_event-toolbar";
import { PhotoGallery, type GalleryPhoto } from "./_photo-gallery";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const [{ data: event, error }, { data: folders }, { data: photos }, authResult] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, name, event_date, is_indexed, share_link_expires_days, rekognition_collection_id, share_token, share_token_expires_at, sync_started_at, sync_completed_at, sync_photo_count, tenant_id",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("event_storage_folders")
        .select("id, label, folder_id")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("photos")
        .select("id, r2_web_url, is_hidden, face_details, storage_file_id")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);

  if (error || !event) notFound();

  // Check Drive connection
  let driveConnected = false;
  const currentUser = authResult.data?.user ?? null;
  if (currentUser && event.tenant_id) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("google_refresh_token")
      .eq("id", event.tenant_id)
      .single();
    driveConnected = !!tenant?.google_refresh_token;
  }

  const photoList: GalleryPhoto[] = (photos ?? []).map((p) => ({
    id: p.id,
    r2_web_url: p.r2_web_url,
    is_hidden: p.is_hidden ?? false,
    face_details: (p.face_details as GalleryPhoto["face_details"]) ?? [],
    storage_file_id: p.storage_file_id ?? "",
  }));

  const folderList = folders ?? [];
  const hasPhotos = photoList.length > 0;

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <header className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <nav className="text-sm mb-2">
            <Link
              href="/dashboard"
              className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              ← Events
            </Link>
          </nav>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {event.name}
            </h1>
            <StatusBadge isIndexed={event.is_indexed} />
          </div>
          {formattedDate && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formattedDate}
            </p>
          )}
        </div>

        {/* Action icons + Edit/Delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <EventToolbar
            eventId={event.id}
            eventName={event.name}
            driveConnected={driveConnected}
            folders={folderList}
            isIndexed={event.is_indexed}
            lastSyncAt={event.sync_completed_at ?? null}
            lastSyncCount={event.sync_photo_count ?? 0}
            shareToken={event.share_token}
            shareExpiresAt={event.share_token_expires_at}
            defaultDays={event.share_link_expires_days}
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
          />

          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />

          <Link
            href={`/dashboard/events/${event.id}/edit`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            แก้ไข
          </Link>
          <DeleteEventButton id={event.id} name={event.name} />
        </div>
      </header>

      {/* ── Gallery / Empty state ── */}
      {hasPhotos ? (
        <PhotoGallery eventId={event.id} photos={photoList} />
      ) : (
        <EmptyGallery
          eventId={event.id}
          driveConnected={driveConnected}
          hasFolders={folderList.length > 0}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyGallery({
  eventId,
  driveConnected,
  hasFolders,
}: {
  eventId: string;
  driveConnected: boolean;
  hasFolders: boolean;
}) {
  if (!driveConnected) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 py-20 gap-4 text-center px-6">
        <div className="text-5xl">🔗</div>
        <div className="space-y-1.5">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            ยังไม่ได้เชื่อมต่อ Google Drive
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            เชื่อมต่อ Drive เพื่อเริ่ม sync รูปภาพ
          </p>
        </div>
        <a
          href={`/api/auth/google?redirect=/dashboard/events/${eventId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          เชื่อมต่อ Google Drive
        </a>
      </div>
    );
  }

  if (!hasFolders) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 py-20 gap-4 text-center px-6">
        <div className="text-5xl">📁</div>
        <div className="space-y-1.5">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            ยังไม่มี Drive folder
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            เพิ่ม folder ของช่างภาพก่อน แล้วค่อย sync
          </p>
        </div>
        <Link
          href={`/dashboard/events/${eventId}/edit`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          เพิ่ม folder
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 py-20 gap-4 text-center px-6">
      <div className="text-5xl">📷</div>
      <div className="space-y-1.5">
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          ยังไม่มีรูปภาพ
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          กด Sync เพื่อดึงรูปจาก Google Drive มา index
        </p>
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        คลิกไอคอน 🔄 ด้านบนขวาเพื่อเริ่ม Sync
      </p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isIndexed }: { isIndexed: boolean }) {
  if (isIndexed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Not synced
    </span>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { CameraIcon, FolderIcon, LinkSlashIcon, ArrowPathIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buttonVariants } from "@/components/ui/button";
import { EventToolbar } from "./_event-toolbar";
import { EventTitleEditor } from "./_event-title-editor";
import { PhotoGallery, type GalleryPhoto } from "./_photo-gallery";
import { LivenessToggle } from "./_liveness-toggle";

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
          "id, name, event_date, is_indexed, share_link_expires_days, rekognition_collection_id, share_token, share_token_expires_at, sync_started_at, sync_completed_at, sync_photo_count, tenant_id, credits_used, liveness_required",
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
        .select("id, r2_web_url, visibility, face_details, storage_file_id, original_filename, taken_at, photographer_name, copyright")
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
    visibility: (p.visibility ?? "match_only") as GalleryPhoto["visibility"],
    face_details: (p.face_details as GalleryPhoto["face_details"]) ?? [],
    storage_file_id: p.storage_file_id ?? "",
    original_filename: p.original_filename ?? null,
    taken_at: p.taken_at ?? null,
    photographer_name: p.photographer_name ?? null,
    copyright: p.copyright ?? null,
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
      <header className="flex items-end gap-4 justify-between">
        <div className="flex-1 min-w-0">
          <nav className="text-sm mb-2">
            <Link
              href="/dashboard"
              className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              ← Events
            </Link>
          </nav>
          <div className="flex items-baseline gap-3 flex-wrap">
            <EventTitleEditor eventId={event.id} initialName={event.name} />
            {formattedDate && (
              <span className="text-sm text-zinc-400 dark:text-zinc-500 select-none font-sans mt-0.5">
                {formattedDate}
              </span>
            )}
            <StatusBadge isIndexed={event.is_indexed} />
          </div>
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

          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1.5" />

          <Link
            href={`/dashboard/events/${event.id}/edit`}
            className="cta-button h-8 px-2.5 sm:px-3 text-[10px] sm:text-xs rounded-[2px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-all duration-300 font-mono leading-none"
          >
            <PencilSquareIcon className="h-4 w-4 stroke-[1.5] flex-shrink-0 relative top-[-0.5px]" />
            <span className="hidden sm:inline relative top-[0.5px]">Edit</span>
          </Link>
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

      <LivenessToggle eventId={event.id} initial={event.liveness_required ?? false} />
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
      <EmptyShell>
        <LinkSlashIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          ยังไม่ได้เชื่อมต่อ Google Drive
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          เชื่อมต่อ Drive เพื่อเริ่ม sync รูปภาพ
        </p>
        <a
          href={`/api/auth/google?redirect=/dashboard/events/${eventId}`}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          เชื่อมต่อ Google Drive
        </a>
      </EmptyShell>
    );
  }

  if (!hasFolders) {
    return (
      <EmptyShell>
        <FolderIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          ยังไม่มี Drive folder
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          เพิ่ม folder ของช่างภาพก่อน แล้วค่อย sync
        </p>
        <Link
          href={`/dashboard/events/${eventId}?open=folders`}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          เพิ่ม folder
        </Link>
      </EmptyShell>
    );
  }

  return (
    <EmptyShell>
      <CameraIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
      <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
        ยังไม่มีรูปภาพ
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        กด Sync เพื่อดึงรูปจาก Google Drive มา index
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1 mt-1">
        <ArrowPathIcon className="h-3.5 w-3.5" /> คลิกไอคอน Sync ด้านบนขวาเพื่อเริ่ม
      </p>
    </EmptyShell>
  );
}

// ─── Empty shell ─────────────────────────────────────────────────────────────

function EmptyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-20 gap-2 text-center px-6">
      {children}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isIndexed }: { isIndexed: boolean }) {
  if (isIndexed) {
    return (
      <span className="inline-flex items-center rounded-none bg-emerald-50/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[10px] font-semibold font-mono tracking-wider uppercase text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 relative top-[0.5px]">
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-none bg-zinc-100/40 dark:bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400 border border-zinc-500/20 relative top-[0.5px]">
      Not synced
    </span>
  );
}

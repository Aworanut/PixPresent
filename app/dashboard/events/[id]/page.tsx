import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buttonVariants } from "@/components/ui/button";
import { driveFolderUrl } from "@/lib/google-drive";
import { DeleteEventButton } from "./_delete-button";
import { ShareLinkPanel } from "./_share-link-panel";
import { SyncButton } from "./_sync-button";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const admin = createServiceRoleClient();

  const [{ data: event, error }, { data: folders }, authResult] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, name, event_date, is_indexed, share_link_expires_days, rekognition_collection_id, activated_at, created_at, share_token, share_token_expires_at, sync_started_at, sync_completed_at, sync_photo_count, tenant_id",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("event_storage_folders")
        .select("id, label, folder_id")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);

  if (error || !event) notFound();

  // Check if this organizer has connected Google Drive
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

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const folderList = folders ?? [];

  return (
    <div className="max-w-3xl space-y-8">
      <nav className="text-sm">
        <Link
          href="/dashboard"
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Events
        </Link>
      </nav>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <StatusBadge isIndexed={event.is_indexed} />
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {event.name}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${event.id}/blacklist`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Blacklist
          </Link>
          <Link
            href={`/dashboard/events/${event.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            แก้ไข
          </Link>
          <DeleteEventButton id={event.id} name={event.name} />
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Google Drive folders ({folderList.length})
        </h2>
        {folderList.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            ยังไม่มี folder — กด <Link href={`/dashboard/events/${event.id}/edit`} className="underline">แก้ไข</Link> เพื่อเพิ่ม
          </p>
        ) : (
          <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
            {folderList.map((folder) => (
              <li key={folder.id} className="px-4 py-3 sm:px-6 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {folder.label && (
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {folder.label}
                    </p>
                  )}
                  <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                    {folder.folder_id}
                  </p>
                </div>
                <a
                  href={driveFolderUrl(folder.folder_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  เปิด ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Sync &amp; Index
        </h2>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 sm:px-6">
          <SyncButton
            eventId={event.id}
            driveConnected={driveConnected}
            isIndexed={event.is_indexed}
            lastSyncCount={event.sync_photo_count ?? 0}
            lastSyncAt={event.sync_completed_at ?? null}
          />
        </div>
      </section>

      <ShareLinkPanel
        eventId={event.id}
        token={event.share_token}
        expiresAt={event.share_token_expires_at}
        defaultDays={event.share_link_expires_days}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      />

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        <Detail
          label="Rekognition Collection"
          value={
            event.rekognition_collection_id ??
            "ยังไม่ได้สร้าง — จะถูกสร้างตอน Sync (#7)"
          }
        />
        <Detail
          label="สถานะ activate"
          value={
            event.activated_at
              ? new Date(event.activated_at).toLocaleString("th-TH")
              : "Draft (ยัง activate — #14)"
          }
        />
      </section>

      <section className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm text-zinc-500 dark:text-zinc-400">
        <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          ขั้นถัดไป
        </p>
        <p>
          Sync &amp; Index รูปจาก folder (#7) → จัดการ blacklist (#8) → Generate
          guest link (#9)
        </p>
      </section>
    </div>
  );
}

function StatusBadge({ isIndexed }: { isIndexed: boolean }) {
  if (isIndexed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Not synced
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="px-4 py-3 sm:px-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-sm text-zinc-900 dark:text-zinc-100 break-all">
        {value ?? "—"}
      </dd>
    </div>
  );
}

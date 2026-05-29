import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEvent } from "@/lib/actions/events";
import { EventForm } from "../../_components/event-form";
import { DeleteEventButton } from "../_delete-button";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event, error }, { data: folders }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date, sync_started_at, credits_used, cover_image_url")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("event_storage_folders")
      .select("label, folder_id")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !event) notFound();

  const boundUpdate = updateEvent.bind(null, event.id);

  return (
    <div className="w-full flex items-center justify-center py-4 sm:py-8">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-none shadow-sm p-6 sm:p-8 space-y-6">
        <nav className="text-sm">
          <Link
            href={`/dashboard/events/${event.id}`}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← {event.name}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            แก้ไข Event
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ปรับแก้ข้อมูลพื้นฐานและเปลี่ยนสไตล์ภาพปกของ Event นี้
          </p>
        </header>

        <EventForm
          action={boundUpdate}
          submitLabel="บันทึก"
          pendingLabel="กำลังบันทึก..."
          defaults={{
            name: event.name,
            event_date: event.event_date,
            folders: (folders ?? []).map((f) => ({
              label: f.label,
              folder: f.folder_id,
            })),
            cover_image_url: event.cover_image_url,
          }}
          cancelHref={`/dashboard/events/${event.id}`}
        />

        {/* Danger Zone */}
        <div className="pt-6 border-t border-zinc-150 dark:border-zinc-800/80 space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs font-semibold font-mono tracking-wider text-rose-500 uppercase">
              Danger Zone
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              การลบงานจะคืนเครดิตให้หากงานยังไม่เคยเริ่ม Sync และจะลบข้อมูลรูปภาพทั้งหมดอย่างถาวร
            </p>
          </div>
          <div>
            <DeleteEventButton
              id={event.id}
              name={event.name}
              hasStartedSync={!!event.sync_started_at}
              creditsUsed={event.credits_used ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

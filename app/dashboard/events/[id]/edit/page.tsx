import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEvent } from "@/lib/actions/events";
import { EventForm } from "../../_components/event-form";

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
      .select("id, name, event_date")
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
    <div className="max-w-xl space-y-6">
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
        }}
        cancelHref={`/dashboard/events/${event.id}`}
      />
    </div>
  );
}

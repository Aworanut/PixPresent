import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardPage() {
  const ctx = await getCurrentTenant();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, is_indexed, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = events ?? [];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Events
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {ctx!.tenant.name}
          </h1>
        </div>
        <Link
          href="/dashboard/events/new"
          className={buttonVariants({ variant: "default" })}
        >
          + New event
        </Link>
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {list.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        ยังไม่มี event
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        เริ่มต้นด้วยการสร้าง event แรกของคุณ
      </p>
      <div className="mt-6 inline-block">
        <Link
          href="/dashboard/events/new"
          className={buttonVariants({ variant: "default" })}
        >
          + สร้าง Event แรก
        </Link>
      </div>
    </div>
  );
}

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  is_indexed: boolean;
  created_at: string;
};

function EventCard({ event }: { event: EventRow }) {
  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "ไม่ได้ระบุวันที่";

  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50 truncate">
              {event.name}
            </h3>
            <StatusPill isIndexed={event.is_indexed} />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formattedDate}
          </p>
        </div>
        <span className="text-zinc-400 text-lg" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

function StatusPill({ isIndexed }: { isIndexed: boolean }) {
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

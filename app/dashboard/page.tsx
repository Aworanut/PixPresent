import Link from "next/link";
import { CalendarDaysIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, tenantDisplayName } from "@/lib/auth/current-tenant";
import { buttonVariants } from "@/components/ui/button";
import { ArchiveExplorer, type ArchiveFolderRow } from "./_archive-explorer";

export default async function DashboardPage() {
  const ctx = await getCurrentTenant();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, created_at, cover_image_url, photos(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = events ?? [];

  // Business tier: the dashboard IS a file explorer — every event = a root
  // folder (mask change; see the business-archive-dashboard spec). SaaS tiers
  // keep the card view below.
  if (ctx?.tenant.plan === "business") {
    const folders: ArchiveFolderRow[] = [...list]
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
      .map((e) => ({
        id: e.id,
        name: e.name,
        event_date: e.event_date,
        photoCount: (e.photos as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    return <ArchiveExplorer folders={folders} />;
  }

  // Split by event_date relative to today (Asia/Bangkok). Events with no date
  // or a date that hasn't passed yet are "Ongoing"; dates before today are "Past".
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  const isPast = (d: string | null) => !!d && d.slice(0, 10) < today;
  const ongoing = list.filter((e) => !isPast(e.event_date));
  const past = list.filter((e) => isPast(e.event_date));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
            Events
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
            {ctx ? tenantDisplayName(ctx.tenant) : ""}
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
        <div className="space-y-10">
          {ongoing.length > 0 && (
            <EventSection title="Ongoing" subtitle="กำลังดำเนินอยู่" events={ongoing} />
          )}
          {past.length > 0 && (
            <EventSection title="Past" subtitle="ผ่านไปแล้ว" events={past} muted />
          )}
        </div>
      )}
    </div>
  );
}

function EventSection({
  title,
  subtitle,
  events,
  muted = false,
}: {
  title: string;
  subtitle: string;
  events: EventRow[];
  muted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
          {title}
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-sans tracking-tight">
          {subtitle}
        </span>
        <span className="text-xs text-zinc-300 dark:text-zinc-600 font-mono">
          {events.length}
        </span>
      </div>
      <ul className={`space-y-3${muted ? " opacity-75" : ""}`}>
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-none border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-8 sm:p-16 text-center space-y-5">
      <CalendarDaysIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-700 stroke-[1.5] mx-auto" />
      <div className="space-y-1.5 max-w-md mx-auto">
        <h2 className="text-xl font-medium font-heading text-zinc-900 dark:text-zinc-100">
          ยังไม่มี event
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans tracking-tight">
          เริ่มต้นด้วยการสร้าง event แรกของคุณเพื่อเริ่มเชื่อมต่อโฟลเดอร์ ค้นหาใบหน้า และแบ่งปันความทรงจำ
        </p>
      </div>
      <div className="pt-2">
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
  created_at: string;
  cover_image_url: string | null;
};

function EventCard({ event }: { event: EventRow }) {
  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "ไม่ได้ระบุวันที่";

  const cover = event.cover_image_url;

  return (
    <Link
      href={`` + `/dashboard/events/${event.id}`}
      className="group relative block h-28 sm:h-32 overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] hover:shadow-sm transition-all duration-300"
    >
      {/* พื้นขาวเต็มใบ */}
      <div className="absolute inset-0 bg-white dark:bg-zinc-900" />

      {cover && (
        <>
          {/* รูปย่อฝั่งซ้าย โชว์ส่วนกลางของภาพ (object-center) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="absolute inset-y-0 left-0 h-full w-32 sm:w-40 object-cover object-center pointer-events-none transition-transform duration-500 group-hover:scale-105"
          />
          {/* เฟดขอบขวาของรูปกลืนเป็นพื้นขาว (ซ้าย→ขวา) */}
          <div className="absolute inset-y-0 left-0 w-32 sm:w-40 bg-gradient-to-r from-transparent from-65% to-white dark:to-zinc-900" />
        </>
      )}

      <div
        className={`relative z-10 flex h-full items-center justify-between gap-4 pr-5 sm:pr-6 ${
          cover ? "pl-36 sm:pl-44" : "pl-7 sm:pl-9"
        }`}
      >
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-medium truncate font-sans text-zinc-900 dark:text-zinc-50">
            {event.name}
          </h3>
          <p className="text-xs tracking-wide font-sans text-zinc-400 dark:text-zinc-500">
            {formattedDate}
          </p>
        </div>
        <ArrowRightIcon className="h-4 w-4 stroke-[1.5] flex-shrink-0 transition-all duration-300 text-zinc-400 dark:text-zinc-600 group-hover:text-[#D4AF37] group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}


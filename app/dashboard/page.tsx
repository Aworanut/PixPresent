import Link from "next/link";
import { CalendarDaysIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, tenantDisplayName } from "@/lib/auth/current-tenant";
import { ArchiveExplorer, type ArchiveFolderRow } from "./_archive-explorer";

export default async function DashboardPage() {
  const ctx = await getCurrentTenant();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, created_at, cover_image_url, photos(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rawList = events ?? [];

  // Business tier: the dashboard IS a file explorer — every event = a root
  // folder (mask change; see the business-archive-dashboard spec). SaaS tiers
  // keep the card view below.
  if (ctx?.tenant.plan === "business") {
    const folders: ArchiveFolderRow[] = [...rawList]
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
      .map((e) => ({
        id: e.id,
        name: e.name,
        event_date: e.event_date,
        photoCount: (e.photos as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    return <ArchiveExplorer folders={folders} />;
  }

  // SaaS tier — flatten into typed EventRow (photos count is already fetched)
  const list: EventRow[] = rawList.map((e) => ({
    id: e.id,
    name: e.name,
    event_date: e.event_date,
    created_at: e.created_at,
    cover_image_url: e.cover_image_url,
    photoCount: (e.photos as unknown as { count: number }[])[0]?.count ?? 0,
  }));

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
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#A16207] dark:text-zinc-500 font-mono">
            <span className="inline-block h-px w-5 bg-[#C9A227]/60 flex-none" />
            Events
          </p>
          <h1 className="text-3xl font-light tracking-tight text-[#271A12] dark:text-zinc-50 font-heading">
            {ctx ? tenantDisplayName(ctx.tenant) : ""}
          </h1>
        </div>
        <Link
          href="/dashboard/events/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 flex-shrink-0"
        >
          + New Event
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
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-px w-5 bg-[#C9A227]/60 flex-none" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#A16207] dark:text-zinc-500 font-mono">
          {title}
        </h2>
        <span className="text-xs text-[#5C4A3A] dark:text-zinc-500 font-sans">
          {subtitle}
        </span>
        <span className="text-xs text-[#C9A227]/40 dark:text-zinc-600 font-mono">
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
    <div className="rounded-none border border-[#C9A227]/20 dark:border-zinc-800/80 bg-[#FDFBF7]/60 dark:bg-zinc-900/40 p-8 sm:p-16 text-center space-y-5">
      <CalendarDaysIcon className="h-12 w-12 text-[#C9A227]/40 dark:text-zinc-700 stroke-[1.5] mx-auto" />
      <div className="space-y-1.5 max-w-md mx-auto">
        <h2 className="text-xl font-medium font-heading text-[#271A12] dark:text-zinc-100">
          ยังไม่มี event
        </h2>
        <p className="text-sm text-[#5C4A3A] dark:text-zinc-400 font-sans tracking-tight">
          เริ่มต้นด้วยการสร้าง event แรกของคุณเพื่อเริ่มเชื่อมต่อโฟลเดอร์ ค้นหาใบหน้า และแบ่งปันความทรงจำ
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/dashboard/events/new"
          className="cta-button inline-flex items-center gap-1.5 h-9 px-5 text-[10px] font-mono uppercase tracking-widest rounded-[2px] text-[#271A12] dark:text-zinc-300 leading-none"
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
  photoCount: number;
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
      href={`/dashboard/events/${event.id}`}
      className="group relative block h-28 sm:h-32 overflow-hidden rounded-none border border-[#E8D9BE] dark:border-zinc-800 hover:border-[#C9A227] dark:hover:border-[#C9A227]/60 hover:shadow-[0_4px_24px_-8px_rgba(39,26,18,0.15)] transition-all duration-300"
    >
      {/* white card surface บน linen bg — สร้าง lift */}
      <div className="absolute inset-0 bg-white dark:bg-zinc-900" />

      {/* Bottom gold accent — slides in from left on hover */}
      <span className="absolute bottom-0 inset-x-0 h-px bg-[#C9A227] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

      {cover && (
        <>
          {/* รูปย่อฝั่งซ้าย โชว์ส่วนกลางของภาพ (object-center) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="absolute inset-y-0 left-0 h-full w-32 sm:w-40 object-cover object-center pointer-events-none transition-transform duration-500 group-hover:scale-105"
          />
          {/* เฟดขอบขวาของรูปกลืนเป็นพื้น white (ซ้าย→ขวา) */}
          <div className="absolute inset-y-0 left-0 w-32 sm:w-40 bg-gradient-to-r from-transparent from-65% to-white dark:to-zinc-900" />
        </>
      )}

      <div
        className={`relative z-10 flex h-full items-center justify-between gap-4 pr-5 sm:pr-6 ${
          cover ? "pl-36 sm:pl-44" : "pl-7 sm:pl-9"
        }`}
      >
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold truncate font-sans text-[#271A12] dark:text-zinc-50">
            {event.name}
          </h3>
          <p className="text-xs tracking-wide font-sans text-[#5C4A3A] dark:text-zinc-500">
            {formattedDate}
            {event.photoCount > 0 && (
              <span className="ml-2 text-[#7A6A59]/70 dark:text-zinc-600">
                · {event.photoCount.toLocaleString()} รูป
              </span>
            )}
          </p>
        </div>
        <ArrowRightIcon className="h-4 w-4 stroke-[1.5] flex-shrink-0 transition-all duration-300 text-[#5C4A3A]/50 dark:text-zinc-600 group-hover:text-[#A16207] group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}


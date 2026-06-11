import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import {
  getPerson,
  getPersonPhotos,
  getPendingMatches,
  getTenantEvents,
} from "@/lib/people/queries";
import { confirmMatchAction, rejectMatchAction } from "@/lib/actions/people";
import { DeletePersonButton } from "./_delete-person-button";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) return null;
  if (ctx.tenant.plan !== "business") notFound();

  const { id: personId } = await params;
  const { eventId } = await searchParams;

  const person = await getPerson(personId);
  if (!person) notFound();

  const [photos, pending, events] = await Promise.all([
    getPersonPhotos(personId, eventId),
    getPendingMatches(personId),
    getTenantEvents(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/people" className="text-xs text-zinc-400 hover:text-zinc-600">
            ← สารบัญบุคคล
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {person.name}
          </h1>
          {person.note && <p className="mt-0.5 text-sm text-zinc-500">{person.note}</p>}
        </div>
        <DeletePersonButton personId={personId} />
      </div>

      {/* Event filter */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip href={`/dashboard/people/${personId}`} active={!eventId} label="ทั้งหมด" />
          {events.map((e) => (
            <FilterChip
              key={e.id}
              href={`/dashboard/people/${personId}?eventId=${e.id}`}
              active={eventId === e.id}
              label={e.name}
            />
          ))}
        </div>
      )}

      {/* Confirmed photo grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          รูปที่ยืนยันแล้ว ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="text-sm text-zinc-400">
            ยังไม่มีรูป — ถ้าเพิ่งเพิ่มบุคคล ระบบกำลังค้นอยู่ ลองรีเฟรชอีกครั้ง
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.photoId}
                className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
              >
                {photo.url && (
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 20vw"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending review */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-amber-600 dark:text-amber-400">
            รอยืนยัน ({pending.length}) — ความเหมือนต่ำกว่า 90%
          </h2>
          <div className="space-y-2">
            {pending.map((match) => (
              <div
                key={match.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-2"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  {match.url && (
                    <Image src={match.url} alt="" fill className="object-cover" sizes="48px" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{match.eventName}</p>
                  <p className="text-xs text-zinc-400">
                    ความเหมือน {match.confidence?.toFixed(0) ?? "?"}%
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <form
                    action={async () => {
                      "use server";
                      await confirmMatchAction(match.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600 transition-colors"
                    >
                      ยืนยัน
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await rejectMatchAction(match.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded bg-rose-500 px-2 py-1 text-xs text-white hover:bg-rose-600 transition-colors"
                    >
                      ปฏิเสธ
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-zinc-200 dark:border-zinc-800 pt-4 text-xs text-zinc-400">
        ข้อมูลใบหน้าและรูปภาพถูกเก็บและประมวลผลตามนโยบายความเป็นส่วนตัวภายในองค์กร
      </p>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 text-zinc-600 hover:border-[#D4AF37] dark:border-zinc-700 dark:text-zinc-400"
      }`}
    >
      {label}
    </Link>
  );
}

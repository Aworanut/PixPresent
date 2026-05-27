import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoViewer } from "./_photo-viewer";

type Props = { params: Promise<{ id: string }> };

export default async function BlacklistPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: photos }, { data: blacklist }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, name")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("photos")
        .select("id, r2_web_url, face_details")
        .eq("event_id", id)
        .not("r2_web_url", "is", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("face_blacklist")
        .select("face_id")
        .eq("event_id", id),
    ]);

  if (!event) notFound();

  const blockedSet = new Set((blacklist ?? []).map((b) => b.face_id));

  type FaceDetail = { face_id: string; bbox: { left: number; top: number; width: number; height: number } };

  const photoList = (photos ?? [])
    .filter((p) => p.r2_web_url)
    .map((p) => ({
      id: p.id,
      r2_web_url: p.r2_web_url!,
      face_details: (p.face_details as FaceDetail[]) ?? [],
      blockedFaceIds: blockedSet,
    }));

  const blockedCount = blacklist?.length ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      <nav className="text-sm">
        <Link
          href={`/dashboard/events/${id}`}
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← {event.name}
        </Link>
      </nav>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Blacklist Manager
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            คลิกรูปเพื่อดูใบหน้า → คลิกกล่องสีเขียวเพื่อบล็อก
          </p>
        </div>
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-sm font-medium text-rose-700 dark:text-rose-400">
            🚫 บล็อกแล้ว {blockedCount} ใบหน้า
          </span>
        )}
      </header>

      {photoList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-10 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ยังไม่มีรูปที่ sync แล้ว —{" "}
            <Link
              href={`/dashboard/events/${id}`}
              className="underline underline-offset-2"
            >
              กลับไป Sync & Index
            </Link>
          </p>
        </div>
      ) : (
        <PhotoViewer eventId={id} photos={photoList} />
      )}
    </div>
  );
}

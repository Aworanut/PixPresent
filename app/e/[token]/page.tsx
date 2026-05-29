import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { FaceSearch } from "./_face-search";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();

  if (!event) return { title: "ไม่พบงาน" };
  return { title: `${event.name} — ค้นหารูปของคุณ` };
}

export default async function GuestEventPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_date, share_token_expires_at, activated_at, data_retention_days")
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();

  // Token not found at all → 404
  if (!event) notFound();

  const now = new Date();

  // Data retention window + 7-day grace period has elapsed → Rekognition
  // collection was cleaned up by the nightly cron. Show a specific message
  // rather than letting face-search fail with a generic error.
  const isDataExpired = !!event.activated_at && (() => {
    const cutoff = new Date(event.activated_at!);
    cutoff.setDate(cutoff.getDate() + (event.data_retention_days ?? 7) + 7);
    return cutoff < now;
  })();

  const isExpired =
    !event.share_token_expires_at ||
    new Date(event.share_token_expires_at) <= now;

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  if (isDataExpired) {
    return <DataExpiredPage eventName={event.name} />;
  }

  if (isExpired) {
    return <ExpiredPage eventName={event.name} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ค้นหารูปด้วย AI
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {event.name}
          </h1>
          {formattedDate && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {formattedDate}
            </p>
          )}
        </div>

        {/* Face search widget */}
        <FaceSearch eventId={event.id} shareToken={token} />

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          Powered by{" "}
          <span className="font-medium text-zinc-500 dark:text-zinc-500">
            PixPresent
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Error states ─────────────────────────────────────────────────────────────

function DataExpiredPage({ eventName }: { eventName: string }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🗂️</div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {eventName}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          ข้อมูลงานนี้ถูกลบออกจากระบบแล้ว
          <br />
          เกินระยะเวลาเก็บข้อมูลตามแพ็กเกจที่เลือกไว้
        </p>
      </div>
    </div>
  );
}

function ExpiredPage({ eventName }: { eventName: string }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {eventName}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          ลิงก์นี้หมดอายุแล้ว หรือถูกยกเลิกโดยผู้จัดงาน
          <br />
          กรุณาขอลิงก์ใหม่จากผู้จัดงาน
        </p>
      </div>
    </div>
  );
}

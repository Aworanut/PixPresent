import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isRetentionExpired } from "@/lib/tenant-plans";
import { FaceSearch } from "./_face-search";
import { InAppBrowserNotice } from "./_inapp-browser-notice";
import { GuestFeedback } from "./_guest-feedback";

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
    .select("id, name, event_date, share_token_expires_at, activated_at, data_retention_days, tenant_id, cover_image_url")
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();

  // Token not found at all → 404
  if (!event) notFound();

  // Fetch linked photographer/studio tenant profile
  const { data: tenant } = await supabase
    .from("tenants")
    .select("display_name, name, avatar_url, phone, line_id, instagram_username, facebook_url, bio, tiktok_username, plan")
    .eq("id", event.tenant_id)
    .single();

  const now = new Date();

  // Data retention window + 7-day grace period has elapsed → Rekognition
  // collection was cleaned up by the nightly cron. Show a specific message
  // rather than letting face-search fail with a generic error. Unlimited-
  // retention plans (business) are never cleaned up, so they never expire —
  // mirrors the cron's UNLIMITED_RETENTION_PLANS skip.
  const isDataExpired = isRetentionExpired({
    plan: tenant?.plan,
    activatedAt: event.activated_at,
    dataRetentionDays: event.data_retention_days,
    now,
  });

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Cover Image Banner */}
      {event.cover_image_url ? (
        <div className="relative w-full h-48 sm:h-60 md:h-64 overflow-hidden bg-zinc-900 select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image_url}
            alt="Event Cover"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 via-transparent to-black/20" />
        </div>
      ) : null}

      <div className={`max-w-lg w-full mx-auto px-4 py-8 space-y-8 flex-1 flex flex-col justify-between ${event.cover_image_url ? "-mt-16 sm:-mt-20 relative z-10" : ""}`}>
        {/* Main Content Area */}
        <div className="space-y-8 w-full">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 shadow-sm backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ค้นหารูปด้วย AI
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
              {event.name}
            </h1>
            {formattedDate && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans tracking-tight">
                {formattedDate}
              </p>
            )}
          </div>

          {/* In-app browser nudge (LINE/FB camera often blocked) */}
          <InAppBrowserNotice />

          {/* Face search widget */}
          <FaceSearch eventId={event.id} shareToken={token} />

          {/* Feedback (page-level; self-reports the find-rate signal) */}
          <GuestFeedback eventId={event.id} shareToken={token} />
        </div>

        {/* Studio Business Card & Footer */}
        <div className="space-y-8 pt-8 border-t border-zinc-200/60 dark:border-zinc-800/60 w-full">
          {tenant && (
            <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-none p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                {/* Logo / Avatar */}
                <div className="h-12 w-12 rounded-none border border-[#D4AF37]/45 bg-zinc-50 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                  {tenant.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tenant.avatar_url}
                      alt={tenant.display_name || tenant.name}
                      className="h-full w-full object-cover select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold font-mono text-[#D4AF37]">
                      {(tenant.display_name || tenant.name).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Studio / Photographer Name */}
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[9px] font-mono tracking-widest text-[#D4AF37] uppercase font-bold">
                    STUDIO / PHOTOGRAPHER
                  </span>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 font-heading truncate">
                    {tenant.display_name || tenant.name}
                  </h3>
                </div>
              </div>

              {/* Bio description if present */}
              {tenant.bio && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans leading-relaxed pt-3 border-t border-zinc-100 dark:border-zinc-800/40">
                  {tenant.bio}
                </p>
              )}

              {/* Social Channels & Contact details */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tenant.phone && (
                  <a
                    href={`tel:${tenant.phone}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] text-[10px] font-mono tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-[1px] uppercase bg-transparent"
                  >
                    <PhoneIcon className="h-3 w-3 stroke-[1.5]" />
                    <span>{tenant.phone}</span>
                  </a>
                )}
                {tenant.line_id && (
                  <a
                    href={`https://line.me/R/ti/p/~${tenant.line_id.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] text-[10px] font-mono tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-[1px] uppercase bg-transparent"
                  >
                    <LineIcon className="h-3 w-3 stroke-[1.5]" />
                    <span>LINE: {tenant.line_id}</span>
                  </a>
                )}
                {tenant.instagram_username && (
                  <a
                    href={`https://instagram.com/${tenant.instagram_username.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] text-[10px] font-mono tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-[1px] uppercase bg-transparent"
                  >
                    <InstagramIcon className="h-3 w-3 stroke-[1.5]" />
                    <span>@{tenant.instagram_username.replace(/^@/, "")}</span>
                  </a>
                )}
                {tenant.facebook_url && (
                  <a
                    href={tenant.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] text-[10px] font-mono tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-[1px] uppercase bg-transparent"
                  >
                    <FacebookIcon className="h-3 w-3 stroke-[1.5]" />
                    <span>FACEBOOK</span>
                  </a>
                )}
                {tenant.tiktok_username && (
                  <a
                    href={`https://tiktok.com/@${tenant.tiktok_username.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 dark:border-zinc-800 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] text-[10px] font-mono tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-[1px] uppercase bg-transparent"
                  >
                    <TikTokIcon className="h-3 w-3 stroke-[1.5]" />
                    <span>TIKTOK</span>
                  </a>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 select-none">
            Powered by{" "}
            <span className="font-semibold text-zinc-500 dark:text-zinc-500">
              PixPresent
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Minimal Custom SVG Icons ──────────────────────────────────────────────────

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 0 1-7.108-7.108c-.145-.44.02-1.026.395-1.297l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  );
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M12 3C7.03 3 3 6.2 3 10.1c0 3.5 3.2 6.4 7.6 7l-.2 1.5c-.05.38.14.5.44.29l2-1.45c.22-.16.5-.22.77-.18c3.9.3 7.4-2.7 7.4-7.25C21 6.2 16.97 3 12 3z M7 8.5h1v3h1.2v1H7V8.5z M10.2 8.5h1v4h-1V8.5z M12.8 8.5h0.9l1.6 3v-3h0.9v4h-0.9l-1.6-3v3h-0.9V8.5z M17.5 8.5h2.5v0.9H18.4v0.6h1.3v0.9H18.4v0.7H20v0.9h-2.5V8.5z" 
      />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
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

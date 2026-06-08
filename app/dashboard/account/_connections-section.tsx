"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dropbox, GoogleDrive } from "@thesvg/react";
import { disconnectProvider, type StorageProviderId } from "@/lib/actions/connections";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ProviderStatus = {
  id: StorageProviderId;
  label: string;
  connected: boolean;
  connectedAt: string | null;
};

const ICONS: Record<StorageProviderId, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  google: GoogleDrive,
  dropbox: Dropbox,
};

// ─── Feedback banner (driven by OAuth callback query params) ─────────────────────

const ERROR_LABEL: Record<string, string> = {
  google_denied: "คุณปฏิเสธการเชื่อมต่อ Google Drive",
  google_invalid: "คำขอเชื่อมต่อ Google Drive ไม่ถูกต้อง",
  google_exchange: "แลกโทเค็น Google ไม่สำเร็จ — ลองใหม่อีกครั้ง",
  google_no_refresh_token: "เชื่อมต่อไม่สมบูรณ์ — ถอนสิทธิ์ที่ Google แล้วเชื่อมใหม่",
  google_save_failed: "บันทึกการเชื่อมต่อ Google ไม่สำเร็จ",
  google_not_configured: "ยังไม่ได้ตั้งค่า Google OAuth บนเซิร์ฟเวอร์",
  dropbox_denied: "คุณปฏิเสธการเชื่อมต่อ Dropbox",
  dropbox_invalid: "คำขอเชื่อมต่อ Dropbox ไม่ถูกต้อง",
  dropbox_exchange: "แลกโทเค็น Dropbox ไม่สำเร็จ — ลองใหม่อีกครั้ง",
  dropbox_no_refresh_token: "เชื่อมต่อไม่สมบูรณ์ — ลองเชื่อมใหม่อีกครั้ง",
  dropbox_save_failed: "บันทึกการเชื่อมต่อ Dropbox ไม่สำเร็จ",
  dropbox_not_configured: "ยังไม่ได้ตั้งค่า Dropbox OAuth บนเซิร์ฟเวอร์",
};

function FeedbackBanner() {
  const params = useSearchParams();
  const connected =
    params?.get("google") === "connected"
      ? "Google Drive"
      : params?.get("dropbox") === "connected"
        ? "Dropbox"
        : null;
  const error = params?.get("error");

  if (connected) {
    return (
      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        เชื่อมต่อ {connected} เรียบร้อยแล้ว ✓
      </div>
    );
  }
  if (error && ERROR_LABEL[error]) {
    return (
      <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
        {ERROR_LABEL[error]}
      </div>
    );
  }
  return null;
}

// ─── Provider card ───────────────────────────────────────────────────────────────

function formatConnectedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = ICONS[provider.id];
  const connectHref = `/api/auth/${provider.id}?redirect=/dashboard/account/connections`;
  const since = formatConnectedAt(provider.connectedAt);

  const disconnect = () => {
    if (!window.confirm(`ยกเลิกการเชื่อมต่อ ${provider.label}? event ทั้งหมดจะ sync รูปไม่ได้จนกว่าจะเชื่อมใหม่`)) return;
    startTransition(async () => {
      await disconnectProvider(provider.id);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {provider.label}
          </p>
          {provider.connected ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              เชื่อมต่อแล้ว{since ? ` · ${since}` : ""}
            </p>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              ยังไม่เชื่อมต่อ
            </p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {provider.connected ? (
          <>
            <a
              href={connectHref}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-300 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Reconnect
            </a>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 underline underline-offset-2 hover:text-rose-700 dark:hover:text-rose-300 disabled:opacity-50"
            >
              {pending ? "..." : "Disconnect"}
            </button>
          </>
        ) : (
          <a
            href={connectHref}
            className="inline-flex items-center rounded-lg bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Connect
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────────

export function ConnectionsSection({ providers }: { providers: ProviderStatus[] }) {
  return (
    <div className="space-y-4">
      <FeedbackBanner />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        เชื่อมต่อแหล่งเก็บรูปเพื่อ sync รูปเข้า event การเชื่อมต่อใช้ร่วมกันทุก event ในบัญชีนี้
      </p>
      <div className="space-y-3">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>
    </div>
  );
}

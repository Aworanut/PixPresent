"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setShareLink, revokeShareLink } from "@/lib/actions/share-link";

type Props = {
  eventId: string;
  token: string | null;
  expiresAt: string | null;
  defaultDays: number;
  appUrl: string;
};

type Status = "none" | "active" | "expired";

function deriveStatus(token: string | null, expiresAt: string | null): Status {
  if (!token) return "none";
  if (!expiresAt) return "expired";
  return new Date(expiresAt) > new Date() ? "active" : "expired";
}

export function ShareLinkPanel({
  eventId,
  token,
  expiresAt,
  defaultDays,
  appUrl,
}: Props) {
  const [days, setDays] = useState(defaultDays);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const status = deriveStatus(token, expiresAt);
  const url = token ? `${appUrl}/e/${token}` : null;

  const onGenerate = () => {
    startTransition(async () => {
      await setShareLink(eventId, days);
    });
  };

  const onRevoke = () => {
    if (!window.confirm("ยกเลิกลิงก์ตอนนี้? guest จะใช้ลิงก์เดิมต่อไม่ได้")) {
      return;
    }
    startTransition(async () => {
      await revokeShareLink(eventId);
    });
  };

  const onCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — fallback prompt could be added if needed
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Guest share link
        </h2>
        <StatusPill status={status} />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
        {url ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Link
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="flex-1 min-w-0 text-xs sm:text-sm font-mono break-all text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1.5">
                {url}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopy}
                disabled={pending}
              >
                {copied ? "Copied ✓" : "Copy"}
              </Button>
            </div>
            {expiresAt && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {status === "active" ? "หมดอายุ " : "หมดอายุไปเมื่อ "}
                {new Date(expiresAt).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ยังไม่มีลิงก์ — generate ลิงก์เพื่อให้ guest ค้นหารูปได้
          </p>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="share-link-days" className="text-xs">
              อายุ (วัน)
            </Label>
            <Input
              id="share-link-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24"
            />
          </div>

          <Button type="button" onClick={onGenerate} disabled={pending}>
            {pending
              ? "กำลังบันทึก..."
              : status === "none"
                ? "Generate link"
                : "Regenerate"}
          </Button>

          {status === "active" && (
            <Button
              type="button"
              variant="outline"
              onClick={onRevoke}
              disabled={pending}
              className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Revoke
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Not generated
    </span>
  );
}

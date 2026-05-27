"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type SyncStatus =
  | { phase: "idle" }
  | { phase: "listing"; folder: string }
  | { phase: "syncing"; folder: string; done: number; total: number }
  | { phase: "done"; photoCount: number }
  | { phase: "warned"; message: string }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

type Props = {
  eventId: string;
  driveConnected: boolean;
  isIndexed: boolean;
  lastSyncCount: number;
  lastSyncAt: string | null;
};

export function SyncButton({
  eventId,
  driveConnected,
  isIndexed,
  lastSyncCount,
  lastSyncAt,
}: Props) {
  const [status, setStatus] = useState<SyncStatus>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleSync = async () => {
    if (status.phase === "listing" || status.phase === "syncing") return;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus({ phase: "listing", folder: "…" });

    let res: Response;
    try {
      res = await fetch(`/api/events/${eventId}/sync`, {
        method: "POST",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setStatus({ phase: "error", message: (err as Error).message });
      return;
    }

    if (!res.ok || !res.body) {
      setStatus({ phase: "error", message: `HTTP ${res.status}` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // If the user clicks Stop, cancel the reader (server detects closed connection)
    controller.signal.addEventListener("abort", () => {
      reader.cancel();
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            handleSyncEvent(event, setStatus, router);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        setStatus({ phase: "cancelled" });
      } else {
        setStatus({ phase: "error", message: (err as Error).message });
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus({ phase: "cancelled" });
  };

  const isRunning = status.phase === "listing" || status.phase === "syncing";

  if (!driveConnected) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3">
        <span>ต้อง connect Google Drive ก่อน Sync</span>
        <a
          href={`/api/auth/google?redirect=/dashboard/events/${eventId}`}
          className="font-medium underline underline-offset-2 whitespace-nowrap"
        >
          เชื่อมต่อ ↗
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lastSyncAt && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Sync ล่าสุด:{" "}
          {new Date(lastSyncAt).toLocaleString("th-TH", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · {lastSyncCount.toLocaleString()} รูป
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          onClick={handleSync}
          disabled={isRunning}
        >
          {isRunning
            ? "กำลัง Sync..."
            : isIndexed
              ? "Re-sync"
              : "Sync & Index"}
        </Button>

        {/* Stop button — visible only while running */}
        {isRunning && (
          <Button
            type="button"
            variant="outline"
            onClick={handleStop}
            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            หยุด
          </Button>
        )}

        {/* Status text */}
        {status.phase === "listing" && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            กำลังนับรูปใน {status.folder}…
          </span>
        )}
        {status.phase === "syncing" && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {status.folder}: {status.done.toLocaleString()} / {status.total.toLocaleString()} รูป
          </span>
        )}
        {status.phase === "done" && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Sync สำเร็จ — {status.photoCount.toLocaleString()} รูปใหม่
          </span>
        )}
        {status.phase === "cancelled" && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            หยุดแล้ว — รูปที่ sync ไปแล้วยังคงอยู่
          </span>
        )}
        {status.phase === "error" && (
          <span className="text-sm text-rose-600 dark:text-rose-400">
            ⚠ {status.message}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {status.phase === "syncing" && status.total > 0 && (
        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300"
            style={{ width: `${(status.done / status.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function handleSyncEvent(
  event: Record<string, unknown>,
  setStatus: (s: SyncStatus) => void,
  router: ReturnType<typeof useRouter>,
) {
  switch (event.type) {
    case "progress":
      if (event.phase === "listing") {
        setStatus({ phase: "listing", folder: String(event.folder ?? "…") });
      } else {
        setStatus({
          phase: "syncing",
          folder: String(event.folder ?? "…"),
          done: Number(event.done ?? 0),
          total: Number(event.total ?? 0),
        });
      }
      break;
    case "done":
      setStatus({ phase: "done", photoCount: Number(event.photoCount ?? 0) });
      router.refresh();
      break;
    case "error":
      setStatus({ phase: "error", message: String(event.message ?? "Unknown error") });
      break;
    case "warn":
      setStatus({ phase: "done", photoCount: 0 });
      break;
  }
}

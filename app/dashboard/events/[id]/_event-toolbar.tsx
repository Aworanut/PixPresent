"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setShareLink, revokeShareLink } from "@/lib/actions/share-link";
import { updateEventFolders } from "@/lib/actions/events";
import { testDriveFolder, type TestResult } from "@/lib/actions/test-drive-folder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Folder = { id: string; label: string | null; folder_id: string };

type ToolbarProps = {
  eventId: string;
  eventName: string;
  driveConnected: boolean;
  folders: Folder[];
  // Sync state
  isIndexed: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number;
  // Share state
  shareToken: string | null;
  shareExpiresAt: string | null;
  defaultDays: number;
  appUrl: string;
};

type Modal = "drive" | "sync" | "share" | null;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function EventToolbar(props: ToolbarProps) {
  const [open, setOpen] = useState<Modal>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Drive */}
        <IconButton
          label="Google Drive folders"
          onClick={() => setOpen("drive")}
        >
          <DriveIcon />
        </IconButton>

        {/* Sync */}
        <IconButton label="Sync & Index" onClick={() => setOpen("sync")}>
          <SyncIcon />
        </IconButton>

        {/* Share */}
        <IconButton label="Share link & QR" onClick={() => setOpen("share")}>
          <ShareIcon />
        </IconButton>
      </div>

      {/* Modals */}
      {open === "drive" && (
        <DriveModal
          eventId={props.eventId}
          driveConnected={props.driveConnected}
          folders={props.folders}
          onClose={close}
        />
      )}
      {open === "sync" && (
        <SyncModal
          eventId={props.eventId}
          isIndexed={props.isIndexed}
          lastSyncAt={props.lastSyncAt}
          lastSyncCount={props.lastSyncCount}
          driveConnected={props.driveConnected}
          onClose={close}
        />
      )}
      {open === "share" && (
        <ShareModal
          eventId={props.eventId}
          shareToken={props.shareToken}
          shareExpiresAt={props.shareExpiresAt}
          defaultDays={props.defaultDays}
          appUrl={props.appUrl}
          onClose={close}
        />
      )}
    </>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {children}
    </button>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Drive Modal ──────────────────────────────────────────────────────────────

type FolderRow = { label: string; folder_id: string };

function DriveModal({
  eventId,
  driveConnected,
  folders,
  onClose,
}: {
  eventId: string;
  driveConnected: boolean;
  folders: Folder[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<FolderRow[]>(
    folders.length > 0
      ? folders.map((f) => ({ label: f.label ?? "", folder_id: f.folder_id }))
      : [{ label: "", folder_id: "" }],
  );
  const [testResults, setTestResults] = useState<Record<number, TestResult | "testing">>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const update = (idx: number, key: keyof FolderRow, val: string) => {
    // เคลียร์ผลทดสอบเมื่อแก้ไข URL
    if (key === "folder_id") {
      setTestResults((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    }
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };

  const remove = (idx: number) => {
    setTestResults((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx) next[n] = v;
        else if (n > idx) next[n - 1] = v;
      });
      return next;
    });
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ label: "", folder_id: "" }] : next;
    });
  };

  const add = () => setRows((prev) => [...prev, { label: "", folder_id: "" }]);

  const test = (idx: number) => {
    const folderId = rows[idx].folder_id.trim();
    if (!folderId) return;
    setTestResults((prev) => ({ ...prev, [idx]: "testing" }));
    startTransition(async () => {
      const result = await testDriveFolder(eventId, folderId);
      setTestResults((prev) => ({ ...prev, [idx]: result }));
    });
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateEventFolders(eventId, rows);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <Modal title="Google Drive Folders" onClose={onClose}>
      <div className="space-y-4">
        {!driveConnected && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3">
            <span>ยังไม่ได้เชื่อมต่อ Google Drive</span>
            <a
              href={`/api/auth/google?redirect=/dashboard/events/${eventId}`}
              className="font-medium underline underline-offset-2 whitespace-nowrap"
            >
              เชื่อมต่อ ↗
            </a>
          </div>
        )}

        {/* Editable folder table */}
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const testResult = testResults[idx];
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={row.label}
                    onChange={(e) => update(idx, "label", e.target.value)}
                    placeholder="Label"
                    className="w-24 flex-shrink-0 h-8 text-sm"
                    maxLength={60}
                  />
                  <Input
                    type="text"
                    value={row.folder_id}
                    onChange={(e) => update(idx, "folder_id", e.target.value)}
                    placeholder="URL หรือ Folder ID"
                    className={[
                      "flex-1 min-w-0 h-8 text-sm font-mono",
                      testResult && testResult !== "testing"
                        ? testResult.ok
                          ? "border-emerald-400 dark:border-emerald-600"
                          : "border-rose-400 dark:border-rose-600"
                        : "",
                    ].join(" ")}
                  />
                  {/* ทดสอบ button */}
                  <button
                    type="button"
                    onClick={() => test(idx)}
                    disabled={!row.folder_id.trim() || !driveConnected || pending}
                    className="flex-shrink-0 h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors whitespace-nowrap"
                  >
                    {testResult === "testing" ? "…" : "ทดสอบ"}
                  </button>
                  {/* ลบ */}
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    disabled={rows.length === 1 && !row.folder_id && !row.label}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                    aria-label="ลบ"
                  >
                    ×
                  </button>
                </div>

                {/* ผลทดสอบ */}
                {testResult && testResult !== "testing" && (
                  <p className={[
                    "text-xs pl-1",
                    testResult.ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  ].join(" ")}>
                    {testResult.ok ? `✓ ${testResult.name}` : `✗ ${testResult.message}`}
                  </p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={add}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
          >
            + เพิ่ม folder
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          {saved && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ บันทึกแล้ว
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Sync Modal ───────────────────────────────────────────────────────────────

type SyncPhase =
  | { phase: "idle" }
  | { phase: "listing"; folder: string }
  | { phase: "syncing"; folder: string; done: number; total: number }
  | { phase: "done"; photoCount: number }
  | { phase: "warned"; message: string }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

function SyncModal({
  eventId,
  isIndexed,
  lastSyncAt,
  lastSyncCount,
  driveConnected,
  onClose,
}: {
  eventId: string;
  isIndexed: boolean;
  lastSyncAt: string | null;
  lastSyncCount: number;
  driveConnected: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<SyncPhase>({ phase: "idle" });
  const router = useRouter();
  const abortRef = { current: null as AbortController | null };

  const isRunning = status.phase === "listing" || status.phase === "syncing";

  const handleSync = async () => {
    if (isRunning) return;
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

    controller.signal.addEventListener("abort", () => reader.cancel());

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            switch (ev.type) {
              case "progress":
                if (ev.phase === "listing") {
                  setStatus({ phase: "listing", folder: String(ev.folder ?? "…") });
                } else {
                  setStatus({
                    phase: "syncing",
                    folder: String(ev.folder ?? "…"),
                    done: Number(ev.done ?? 0),
                    total: Number(ev.total ?? 0),
                  });
                }
                break;
              case "done":
                setStatus({ phase: "done", photoCount: Number(ev.photoCount ?? 0) });
                router.refresh();
                break;
              case "warn":
                setStatus({ phase: "warned", message: String(ev.message ?? "stub mode") });
                break;
              case "error":
                setStatus({ phase: "error", message: String(ev.message ?? "Unknown error") });
                break;
            }
          } catch { /* ignore parse */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setStatus({ phase: "error", message: (err as Error).message });
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus({ phase: "cancelled" });
  };

  return (
    <Modal title="Sync & Index" onClose={onClose}>
      <div className="space-y-4">
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

        {/* Status */}
        {status.phase === "syncing" && status.total > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {status.folder}: {status.done.toLocaleString()} / {status.total.toLocaleString()} รูป
            </p>
            <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300"
                style={{ width: `${(status.done / status.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {status.phase === "listing" && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            กำลังนับรูปใน {status.folder}…
          </p>
        )}
        {status.phase === "done" && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Sync สำเร็จ — {status.photoCount.toLocaleString()} รูปใหม่
          </p>
        )}
        {status.phase === "cancelled" && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            หยุดแล้ว — รูปที่ sync ไปแล้วยังคงอยู่
          </p>
        )}
        {status.phase === "warned" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {status.message}</p>
        )}
        {status.phase === "error" && (
          <p className="text-xs text-rose-600 dark:text-rose-400">⚠ {status.message}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={handleSync}
            disabled={isRunning || !driveConnected}
            size="sm"
          >
            {isRunning ? "กำลัง Sync..." : isIndexed ? "Re-sync" : "Sync & Index"}
          </Button>
          {isRunning && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900/40 dark:hover:bg-rose-950/30"
            >
              หยุด
            </Button>
          )}
          {!driveConnected && (
            <a
              href={`/api/auth/google?redirect=/dashboard/events/${eventId}`}
              className="text-xs text-zinc-500 dark:text-zinc-400 underline underline-offset-2 self-center"
            >
              เชื่อมต่อ Drive ก่อน
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({
  eventId,
  shareToken,
  shareExpiresAt,
  defaultDays,
  appUrl,
  onClose,
}: {
  eventId: string;
  shareToken: string | null;
  shareExpiresAt: string | null;
  defaultDays: number;
  appUrl: string;
  onClose: () => void;
}) {
  const [days, setDays] = useState(defaultDays);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isActive =
    !!shareToken &&
    !!shareExpiresAt &&
    new Date(shareExpiresAt) > new Date();

  const shareUrl = shareToken ? `${appUrl}/e/${shareToken}` : null;

  const onGenerate = () => {
    startTransition(async () => {
      await setShareLink(eventId, days);
      router.refresh();
    });
  };

  const onRevoke = () => {
    if (!window.confirm("ยกเลิกลิงก์? guest จะใช้ต่อไม่ได้")) return;
    startTransition(async () => {
      await revokeShareLink(eventId);
      router.refresh();
    });
  };

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <Modal title="Share Link & QR Code" onClose={onClose}>
      <div className="space-y-5">
        {/* QR Code */}
        {shareUrl && isActive && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 bg-white">
              <QRCodeSVG value={shareUrl} size={180} />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              แสกน QR หรือส่ง link ด้านล่าง
            </p>
          </div>
        )}

        {/* Link */}
        {shareUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 text-xs font-mono break-all text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
                {shareUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={pending}>
                {copied ? "✓" : "Copy"}
              </Button>
            </div>
            {shareExpiresAt && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {isActive ? "หมดอายุ " : "หมดอายุไปแล้วเมื่อ "}
                {new Date(shareExpiresAt).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ยังไม่มีลิงก์ — กด Generate เพื่อสร้าง
          </p>
        )}

        {/* Controls */}
        <div className="flex items-end gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <div className="space-y-1">
            <Label htmlFor="share-days-modal" className="text-xs">
              อายุ (วัน)
            </Label>
            <Input
              id="share-days-modal"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-20 h-8 text-sm"
            />
          </div>
          <Button type="button" size="sm" onClick={onGenerate} disabled={pending}>
            {pending ? "กำลังสร้าง..." : shareToken ? "Regenerate" : "Generate"}
          </Button>
          {isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRevoke}
              disabled={pending}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900/40"
            >
              Revoke
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M6.28 3h11.44l5.28 9-5.28 9H6.28L1 12z" fillOpacity={0} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"/>
      <path d="M1 12h22M6.28 3l5.72 9-5.72 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12a7.5 7.5 0 0 1 14.25-3.25M19.5 12a7.5 7.5 0 0 1-14.25 3.25"/>
      <path d="M16.5 5.25 19.5 8.75l-3.5 1.25M7.5 18.75 4.5 15.25l3.5-1.25"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-5.368m0 5.368a3 3 0 0 0 4.632 2.026m-4.632-7.394a3 3 0 0 1 4.632-2.026m0 0a3 3 0 1 1 4.632 2.026M15.316 10.658m0 2.684a3 3 0 1 0 0-2.684"/>
    </svg>
  );
}

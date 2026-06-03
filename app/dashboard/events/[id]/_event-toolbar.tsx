"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { FolderIcon, ArrowPathIcon, ArrowUpOnSquareIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setShareLink, revokeShareLink } from "@/lib/actions/share-link";
import { updateEventFolders } from "@/lib/actions/events";
import { testDriveFolder, type TestResult } from "@/lib/actions/test-drive-folder";
import { testDropboxFolder } from "@/lib/actions/test-dropbox-folder";
import { getFolderSyncStatus, type FolderSyncStatus } from "@/lib/actions/folder-sync-status";

// ─── Types ────────────────────────────────────────────────────────────────────

type Folder = { id: string; label: string | null; folder_id: string; source_type: "gdrive" | "dropbox" };

type ToolbarProps = {
  eventId: string;
  eventName: string;
  driveConnected: boolean;
  dropboxConnected: boolean;
  folders: Folder[];
  // Share state
  shareToken: string | null;
  shareExpiresAt: string | null;
  defaultDays: number;
  appUrl: string;
};

type Modal = "drive" | "share" | null;

type SyncPhase =
  | { phase: "idle" }
  | { phase: "listing"; folder: string }
  | { phase: "syncing"; folder: string; done: number; total: number }
  | { phase: "done"; photoCount: number }
  | { phase: "warned"; message: string }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

type SyncToast =
  | { phase: "listing"; folder: string }
  | { phase: "syncing"; folder: string; done: number; total: number }
  | { phase: "done"; photoCount: number }
  | null;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function EventToolbar(props: ToolbarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState<Modal>(null);

  // Sync state — lives here so SSE survives navigation between modals
  const [syncStatus, setSyncStatus] = useState<SyncPhase>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const isRunning = syncStatus.phase === "listing" || syncStatus.phase === "syncing";
  const anyConnected = props.driveConnected || props.dropboxConnected;

  // Auto-dismiss toast 4s after done
  useEffect(() => {
    if (syncStatus.phase !== "done") return;
    const t = setTimeout(() => setSyncStatus({ phase: "idle" }), 4000);
    return () => clearTimeout(t);
  }, [syncStatus.phase]);

  // Derive toast from sync status
  const syncToast: SyncToast = (() => {
    if (syncStatus.phase === "listing") return { phase: "listing", folder: syncStatus.folder };
    if (syncStatus.phase === "syncing") return { phase: "syncing", folder: syncStatus.folder, done: syncStatus.done, total: syncStatus.total };
    if (syncStatus.phase === "done") return { phase: "done", photoCount: syncStatus.photoCount };
    return null;
  })();

  // Auto-open Drive modal when URL has ?open=folders — render-time adjustment (no useEffect)
  const [prevSearchOpen, setPrevSearchOpen] = useState(searchParams?.get("open") ?? "");
  const currentSearchOpen = searchParams?.get("open") ?? "";
  if (currentSearchOpen !== prevSearchOpen) {
    setPrevSearchOpen(currentSearchOpen);
    if (currentSearchOpen === "folders") {
      setOpen("drive");
    }
  }

  const close = () => {
    setOpen(null);
    if (searchParams?.get("open") === "folders") {
      router.replace(`/dashboard/events/${props.eventId}`);
    }
  };

  // ─── Sync handlers ────────────────────────────────────────────────────────

  // One sync invocation: POST /sync and consume the SSE stream until it ends.
  // Returns how the pass ended + how many *new* photos it processed this round.
  // "interrupted" = the stream closed without a terminal event, which on Hobby
  // means the 60s function timed out mid-sync → the caller resumes.
  type PassKind = "done" | "exceeded" | "error" | "interrupted";
  const runSyncPass = async (
    controller: AbortController,
  ): Promise<{ kind: PassKind; processed: number }> => {
    let res: Response;
    try {
      res = await fetch(`/api/events/${props.eventId}/sync`, {
        method: "POST",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return { kind: "interrupted", processed: 0 };
      setSyncStatus({ phase: "error", message: (err as Error).message });
      return { kind: "error", processed: 0 };
    }

    if (!res.ok || !res.body) {
      setSyncStatus({ phase: "error", message: `HTTP ${res.status}` });
      return { kind: "error", processed: 0 };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const onAbort = () => reader.cancel();
    controller.signal.addEventListener("abort", onAbort);

    let processed = 0;
    let terminal: PassKind | null = null;

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
                  setSyncStatus({ phase: "listing", folder: String(ev.folder ?? "…") });
                } else {
                  if (!ev.skipped) processed++;
                  const evDone = Number(ev.done ?? 0);
                  const evTotal = Number(ev.total ?? 0);
                  setSyncStatus({ phase: "syncing", folder: String(ev.folder ?? "…"), done: evDone, total: evTotal });
                  if (evDone > 0 && evDone % 20 === 0) router.refresh();
                }
                break;
              case "done":
                terminal = "done";
                break;
              case "storage_exceeded": {
                terminal = "exceeded";
                const used = ev.usedGb ?? "?";
                const limit = ev.limitGb ?? "?";
                const next = ev.nextTier?.label
                  ? ` — อัปเกรดเป็น ${ev.nextTier.label} เพื่อ sync ต่อ`
                  : "";
                setSyncStatus({ phase: "error", message: `พื้นที่เต็ม ${used}/${limit} GB${next}` });
                router.refresh();
                break;
              }
              case "warn":
                setSyncStatus({ phase: "warned", message: String(ev.message ?? "stub mode") });
                break;
              case "error":
                terminal = "error";
                setSyncStatus({ phase: "error", message: String(ev.message ?? "Unknown error") });
                break;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      controller.signal.removeEventListener("abort", onAbort);
      if ((err as Error).name === "AbortError") return { kind: "interrupted", processed };
      setSyncStatus({ phase: "error", message: (err as Error).message });
      return { kind: "error", processed };
    }
    controller.signal.removeEventListener("abort", onAbort);

    return { kind: terminal ?? "interrupted", processed };
  };

  const handleSync = async () => {
    if (isRunning || !anyConnected) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSyncStatus({ phase: "listing", folder: "…" });

    // Hobby caps each function at 60s, so a large sync gets cut mid-stream.
    // Resume by re-POSTing (already-done photos are skipped server-side) until
    // the server emits a terminal event. Guard against a non-progressing loop:
    // two passes in a row that process zero new photos → stop and let the user
    // retry, rather than spinning forever.
    let totalNew = 0;
    let stuckRounds = 0;
    while (true) {
      const outcome = await runSyncPass(controller);
      if (controller.signal.aborted) return; // user hit Stop (handleStop set the phase)
      totalNew += outcome.processed;

      if (outcome.kind === "done") {
        setSyncStatus({ phase: "done", photoCount: totalNew });
        router.refresh();
        return;
      }
      if (outcome.kind === "exceeded" || outcome.kind === "error") return; // UI already set

      // interrupted → resume unless we've stalled
      if (outcome.processed === 0) {
        if (++stuckRounds >= 2) {
          setSyncStatus({ phase: "error", message: "Sync หยุดกลางคัน — กด Sync อีกครั้งเพื่อทำต่อ" });
          return;
        }
      } else {
        stuckRounds = 0;
        router.refresh(); // surface the photos this pass landed before resuming
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setSyncStatus({ phase: "cancelled" });
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Drive */}
        <IconButton
          label="Google Drive folders"
          onClick={() => setOpen("drive")}
          icon={FolderIcon}
          text="Folders"
        />

        {/* Sync — กดปุ๊บ sync เลย ไม่ต้องผ่าน modal */}
        <IconButton
          label="Import & Index"
          onClick={handleSync}
          icon={ArrowPathIcon}
          text="Sync"
          animate={isRunning}
          disabled={!anyConnected}
        />

        {/* Share */}
        <IconButton
          label="Share link & QR"
          onClick={() => setOpen("share")}
          icon={ArrowUpOnSquareIcon}
          text="Share"
        />
      </div>

      {/* Modals */}
      {open === "drive" && (
        <DriveModal
          eventId={props.eventId}
          driveConnected={props.driveConnected}
          dropboxConnected={props.dropboxConnected}
          folders={props.folders}
          onClose={close}
        />
      )}

      {/* Progress toast */}
      {syncToast !== null && (
        <SyncProgressToast
          toast={syncToast}
          isRunning={isRunning}
          onStop={handleStop}
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
  icon: Icon,
  text,
  animate = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  text: string;
  animate?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="cta-button h-8 px-2.5 sm:px-3 text-[10px] sm:text-xs rounded-[2px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer font-mono leading-none disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Icon className={`h-4 w-4 stroke-[1.5] flex-shrink-0 relative top-[-0.5px]${animate ? " animate-spin" : ""}`} />
      <span className="hidden sm:inline relative top-[0.5px]">{text}</span>
    </button>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  className = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-xl bg-white dark:bg-zinc-900 shadow-2xl transition-all duration-300 ${className}`}
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

type FolderRow = { label: string; folder_id: string; source_type: "gdrive" | "dropbox" };

type FetchStatus = "fetching" | TestResult;

function DriveModal({
  eventId,
  driveConnected,
  dropboxConnected,
  folders,
  onClose,
}: {
  eventId: string;
  driveConnected: boolean;
  dropboxConnected: boolean;
  folders: Folder[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<FolderRow[]>(
    folders.length > 0
      ? folders.map((f) => ({ label: f.label ?? "", folder_id: f.folder_id, source_type: f.source_type ?? "gdrive" }))
      : [{ label: "", folder_id: "", source_type: "gdrive" as const }],
  );
  // per-row fetch status: undefined=ยังไม่ตรวจ, "fetching"=กำลังตรวจ, TestResult=ผลลัพธ์
  const [fetchStatuses, setFetchStatuses] = useState<Record<number, FetchStatus>>({});
  // per-folder sync status (not_synced / partial / synced), keyed by folder_id
  const [syncStatuses, setSyncStatuses] = useState<Record<string, FolderSyncStatus>>({});
  const [syncStatusLoading, setSyncStatusLoading] = useState(folders.length > 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load per-folder sync status when the modal opens. Maps the action's
  // result (keyed by DB folder id) back onto folder_id for row lookup.
  useEffect(() => {
    if (folders.length === 0) {
      setSyncStatusLoading(false);
      return;
    }
    let cancelled = false;
    setSyncStatusLoading(true);
    const idToFolderId = new Map(folders.map((f) => [f.id, f.folder_id]));
    getFolderSyncStatus(eventId)
      .then((results) => {
        if (cancelled) return;
        const byFolderId: Record<string, FolderSyncStatus> = {};
        for (const r of results) {
          const fid = idToFolderId.get(r.folderId);
          if (fid) byFolderId[fid] = r;
        }
        setSyncStatuses(byFolderId);
      })
      .finally(() => {
        if (!cancelled) setSyncStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, folders]);

  const update = (idx: number, key: keyof FolderRow, val: string) => {
    if (key === "folder_id") {
      // เคลียร์ status เมื่อแก้ไข URL
      setFetchStatuses((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    }
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };

  const remove = (idx: number) => {
    setFetchStatuses((prev) => {
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
      return next.length === 0 ? [{ label: "", folder_id: "", source_type: "gdrive" as const }] : next;
    });
  };

  const add = () => setRows((prev) => [...prev, { label: "", folder_id: "", source_type: "gdrive" as const }]);

  // Auto-fetch folder name เมื่อ user ออกจาก field
  const onFolderBlur = (idx: number) => {
    const row = rows[idx];
    const folderId = row.folder_id.trim();
    const currentLabel = row.label.trim();
    const connected = row.source_type === "dropbox" ? dropboxConnected : driveConnected;
    if (!folderId || !connected) return;
    // ถ้ามีผลลัพธ์อยู่แล้วจาก input เดิม ไม่ต้อง fetch ซ้ำ
    const existing = fetchStatuses[idx];
    if (existing && existing !== "fetching") return;

    setFetchStatuses((prev) => ({ ...prev, [idx]: "fetching" }));
    const tester =
      row.source_type === "dropbox"
        ? testDropboxFolder(eventId, folderId)
        : testDriveFolder(eventId, folderId);
    tester.then((result) => {
      setFetchStatuses((prev) => ({ ...prev, [idx]: result }));
      // Auto-fill label ด้วยชื่อ folder ถ้า label ว่างอยู่ตอนที่ blur
      if (result.ok && !currentLabel) {
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, label: result.name } : r)),
        );
      }
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateEventFolders(eventId, rows);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <Modal title="Photo Sources" onClose={onClose} className="sm:max-w-xl md:max-w-2xl">
      <div className="space-y-4">
        {!driveConnected && rows.some((r) => r.source_type === "gdrive") && (
          <ConnectHint label="Google Drive" />
        )}
        {!dropboxConnected && rows.some((r) => r.source_type === "dropbox") && (
          <ConnectHint label="Dropbox" />
        )}

        {/* Editable folder table */}
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const status = fetchStatuses[idx];
            const isOk = status && status !== "fetching" && status.ok;
            const isFail = status && status !== "fetching" && !status.ok;
            const isFetching = status === "fetching";

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <select
                    value={row.source_type}
                    onChange={(e) => {
                      const source_type = e.target.value as "gdrive" | "dropbox";
                      setFetchStatuses((prev) => { const n = { ...prev }; delete n[idx]; return n; });
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, source_type } : r)));
                    }}
                    className="h-8 flex-shrink-0 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-transparent px-1.5 cursor-pointer"
                  >
                    <option value="gdrive">Drive</option>
                    <option value="dropbox">Dropbox</option>
                  </select>
                  <Input
                    type="text"
                    value={row.label}
                    onChange={(e) => update(idx, "label", e.target.value)}
                    placeholder="Label"
                    className="w-28 flex-shrink-0 h-8 text-sm"
                    maxLength={60}
                  />
                  <div className="relative flex-1 min-w-0">
                    <Input
                      type="text"
                      value={row.folder_id}
                      onChange={(e) => update(idx, "folder_id", e.target.value)}
                      onBlur={() => onFolderBlur(idx)}
                      placeholder={row.source_type === "dropbox" ? "Dropbox path หรือลิงก์แชร์" : "URL หรือ Folder ID"}
                      className={[
                        "w-full h-8 text-sm font-mono pr-7",
                        isOk ? "border-emerald-400 dark:border-emerald-600" : "",
                        isFail ? "border-rose-400 dark:border-rose-600" : "",
                      ].join(" ")}
                    />
                    {/* inline status indicator */}
                    {isFetching && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 animate-pulse">
                        ⋯
                      </span>
                    )}
                    {isOk && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    )}
                    {isFail && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-rose-500">
                        ✗
                      </span>
                    )}
                  </div>

                  {/* per-folder sync status — ท้ายบรรทัด */}
                  {Boolean(syncStatuses[row.folder_id] || (syncStatusLoading && row.folder_id)) && (
                    <div className="flex-shrink-0">
                      <FolderSyncBadge
                        status={syncStatuses[row.folder_id]}
                        loading={syncStatusLoading}
                      />
                    </div>
                  )}

                  {/* ลบ row */}
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
        </div>
      </div>
    </Modal>
  );
}

// ─── Folder Sync Badge ────────────────────────────────────────────────────────

function FolderSyncBadge({
  status,
  loading,
}: {
  status?: FolderSyncStatus;
  loading: boolean;
}) {
  if (!status) {
    if (loading) {
      return (
        <span className="whitespace-nowrap text-[10px] font-mono text-zinc-400 dark:text-zinc-500 animate-pulse">
          ตรวจสถานะ…
        </span>
      );
    }
    return null;
  }

  const { state, synced, total } = status;
  const config = {
    not_synced: {
      label: "ยังไม่ sync",
      cls: "bg-zinc-100/60 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-zinc-400/30",
    },
    partial: {
      label: total != null ? `sync บางส่วน · ${synced}/${total}` : "sync บางส่วน",
      cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    synced: {
      label: "sync แล้ว",
      cls: "bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    },
  }[state];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-wide ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

// ─── Connect Hint (points to the account Connections page) ──────────────────────

function ConnectHint({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3">
      <span>ยังไม่ได้เชื่อมต่อ {label}</span>
      <Link href="/dashboard/account/connections" className="font-semibold underline underline-offset-2 whitespace-nowrap">
        ไปที่ Connections →
      </Link>
    </div>
  );
}

// ─── Sync Progress Toast ──────────────────────────────────────────────────────

function SyncProgressToast({
  toast,
  isRunning,
  onStop,
}: {
  toast: NonNullable<SyncToast>;
  isRunning: boolean;
  onStop: () => void;
}) {
  const isDone = toast.phase === "done";
  const pct =
    toast.phase === "syncing" && toast.total > 0
      ? Math.round((toast.done / toast.total) * 100)
      : null;

  return (
    <div className="fixed bottom-20 right-4 z-40 w-72 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
      {/* Progress bar strip at top */}
      {pct !== null && (
        <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isDone && <div className="h-0.5 w-full bg-emerald-500" />}

      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {isDone ? (
            <span className="text-emerald-500 text-base">✓</span>
          ) : (
            <ArrowPathIcon className="h-4 w-4 text-zinc-500 animate-spin" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {toast.phase === "listing" && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
              กำลังนับรูปใน <span className="font-medium">{toast.folder}</span>…
            </p>
          )}
          {toast.phase === "syncing" && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
              <span className="font-medium">{toast.folder}</span>
              {" · "}
              {toast.done.toLocaleString()} / {toast.total.toLocaleString()} รูป
            </p>
          )}
          {toast.phase === "done" && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Import สำเร็จ —{" "}
              <span className="font-medium">{toast.photoCount.toLocaleString()} รูปใหม่</span>
            </p>
          )}
        </div>

        {/* Actions */}
        {isRunning && (
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={onStop}
              className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 underline underline-offset-2"
            >
              หยุด
            </button>
          </div>
        )}
      </div>
    </div>
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



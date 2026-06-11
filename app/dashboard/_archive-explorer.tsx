"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderIcon, FolderPlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { createArchiveFolderAction } from "@/lib/actions/archive";

export type ArchiveFolderRow = {
  id: string;
  name: string;
  event_date: string | null;
  photoCount: number;
};

// Root file-explorer for business tenants: every event = a root folder.
// Clicking a tile opens the event page (the piece-1 folder browse).
export function ArchiveExplorer({ folders }: { folders: ArchiveFolderRow[] }) {
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = q.trim()
    ? folders.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
    : folders;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
            Archive
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
            คลัง
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-none bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49f2e] transition-colors"
        >
          <FolderPlusIcon className="h-4 w-4" />
          สร้างแฟ้ม
        </button>
      </header>

      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นชื่อแฟ้ม…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <FolderIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {q ? `ไม่พบแฟ้มชื่อ "${q}"` : "ยังไม่มีแฟ้ม — กดสร้างแฟ้มแล้วเชื่อมโฟลเดอร์เพื่อเริ่มเก็บรูป"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/events/${f.id}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 hover:border-[#D4AF37] transition-colors"
            >
              <FolderIcon className="h-9 w-9 shrink-0 text-[#D4AF37]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{f.name}</p>
                <p className="text-xs text-zinc-400">
                  {f.event_date
                    ? new Date(f.event_date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
                    : "ไม่ระบุวันที่"}
                  {" · "}
                  {f.photoCount} รูป
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {createOpen && <CreateFolderModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateFolderModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("event_date", date);
        const { eventId } = await createArchiveFolderAction(fd);
        router.push(`/dashboard/events/${eventId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "สร้างแฟ้มไม่สำเร็จ");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">สร้างแฟ้มใหม่</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อแฟ้ม เช่น สงกรานต์ 2026"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          autoFocus
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        <p className="text-xs text-zinc-500">สร้างแล้วเข้าไปเชื่อมโฟลเดอร์ Drive/Dropbox แล้วกด Sync ได้เลย — ไม่หักเครดิต</p>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-mono tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all disabled:opacity-40"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="rounded bg-[#D4AF37] px-4 py-1.5 text-xs font-mono font-semibold tracking-wider text-black hover:bg-[#c49f2e] transition-all disabled:opacity-60"
          >
            {pending ? "กำลังสร้าง…" : "สร้างแฟ้ม"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { hidePhoto, unhidePhoto, deletePhoto } from "@/lib/actions/photos";
import { addToBlacklist } from "@/lib/actions/blacklist";

type FaceDetail = {
  face_id: string;
  bbox: { left: number; top: number; width: number; height: number };
};

export type GalleryPhoto = {
  id: string;
  r2_web_url: string | null;
  is_hidden: boolean;
  face_details: FaceDetail[];
  storage_file_id: string;
};

type Tab = "all" | "hidden";
type View = "grid" | "list";

type Props = {
  eventId: string;
  photos: GalleryPhoto[];
};

export function PhotoGallery({ eventId, photos }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [view, setView] = useState<View>("grid");

  const visible = photos.filter((p) =>
    tab === "all" ? !p.is_hidden : p.is_hidden,
  );

  const hiddenCount = photos.filter((p) => p.is_hidden).length;

  return (
    <div className="space-y-3">
      {/* Tab + view toggle bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            ทั้งหมด ({photos.length})
          </TabButton>
          <TabButton active={tab === "hidden"} onClick={() => setTab("hidden")}>
            ถูกแบน {hiddenCount > 0 && `(${hiddenCount})`}
          </TabButton>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
          <ViewToggle
            active={view === "grid"}
            onClick={() => setView("grid")}
            label="Grid view"
          >
            <GridIcon />
          </ViewToggle>
          <ViewToggle
            active={view === "list"}
            onClick={() => setView("list")}
            label="List view"
          >
            <ListIcon />
          </ViewToggle>
        </div>
      </div>

      {/* Empty tab state */}
      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 py-10 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {tab === "hidden" ? "ยังไม่มีรูปที่ถูกแบน" : "ยังไม่มีรูป"}
          </p>
        </div>
      )}

      {/* Grid */}
      {view === "grid" && visible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {visible.map((photo) => (
            <GridCard
              key={photo.id}
              photo={photo}
              eventId={eventId}
              tab={tab}
            />
          ))}
        </div>
      )}

      {/* List */}
      {view === "list" && visible.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
          {visible.map((photo) => (
            <ListRow
              key={photo.id}
              photo={photo}
              eventId={eventId}
              tab={tab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({
  photo,
  eventId,
  tab,
}: {
  photo: GalleryPhoto;
  eventId: string;
  tab: Tab;
}) {
  const faceCount = photo.face_details.length;
  const url = photo.r2_web_url;

  return (
    <div
      className={[
        "group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800",
        photo.is_hidden ? "opacity-60" : "",
      ].join(" ")}
    >
      {url ? (
        <Image
          src={url}
          alt="event photo"
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-2xl text-zinc-400">
          🖼️
        </div>
      )}

      {/* Face count badge */}
      {faceCount > 0 && (
        <div className="absolute bottom-1 left-1">
          <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-black/60 text-white">
            {faceCount} ใบหน้า
          </span>
        </div>
      )}

      {/* Hidden badge */}
      {photo.is_hidden && (
        <div className="absolute top-1 left-1">
          <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-rose-600/90 text-white">
            แบน
          </span>
        </div>
      )}

      {/* ⋮ menu button */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <PhotoMenu photo={photo} eventId={eventId} tab={tab} />
      </div>
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────

function ListRow({
  photo,
  eventId,
  tab,
}: {
  photo: GalleryPhoto;
  eventId: string;
  tab: Tab;
}) {
  const faceCount = photo.face_details.length;
  const url = photo.r2_web_url;
  const filename = photo.storage_file_id.split("/").pop() ?? photo.storage_file_id;

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-2.5 group",
        photo.is_hidden ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {url ? (
          <Image
            src={url}
            alt="photo"
            fill
            className="object-cover"
            sizes="40px"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-base text-zinc-400">
            🖼️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate font-mono text-xs">
          {filename}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {faceCount > 0 ? `${faceCount} ใบหน้า` : "ไม่พบใบหน้า"}
          {photo.is_hidden && " · แบนอยู่"}
        </p>
      </div>

      {/* ⋮ menu */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <PhotoMenu photo={photo} eventId={eventId} tab={tab} />
      </div>
    </div>
  );
}

// ─── ⋮ Dropdown menu ──────────────────────────────────────────────────────────

function PhotoMenu({
  photo,
  eventId,
  tab,
}: {
  photo: GalleryPhoto;
  eventId: string;
  tab: Tab;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const act = (fn: () => Promise<void>) => {
    setOpen(false);
    startTransition(fn);
  };

  const handleHide = () =>
    act(() => hidePhoto(photo.id, eventId));

  const handleUnhide = () =>
    act(() => unhidePhoto(photo.id, eventId));

  const handleBanFaces = () => {
    if (photo.face_details.length === 0) return;
    if (!window.confirm(`แบนใบหน้าทั้ง ${photo.face_details.length} คนในรูปนี้? guest จะไม่เห็นรูปของคนเหล่านี้ทั้งหมด`)) return;
    act(async () => {
      for (const f of photo.face_details) {
        await addToBlacklist(eventId, f.face_id);
      }
    });
  };

  const handleDelete = () => {
    if (!window.confirm("ลบรูปนี้ถาวร? ไม่สามารถกู้คืนได้")) return;
    act(() => deletePhoto(photo.id, eventId));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-black/50 hover:bg-black/70 text-white text-sm transition-colors disabled:opacity-50"
        aria-label="เมนู"
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 text-sm">
          {photo.is_hidden ? (
            <MenuItem onClick={handleUnhide}>ปลดแบนรูปนี้</MenuItem>
          ) : (
            <MenuItem onClick={handleHide}>🚫 แบนรูปนี้</MenuItem>
          )}

          {photo.face_details.length > 0 && (
            <MenuItem onClick={handleBanFaces}>
              👤 แบนคน{photo.face_details.length > 1 ? `ทั้ง ${photo.face_details.length} คน` : "นี้"}ทั้งหมด
            </MenuItem>
          )}

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <MenuItem onClick={handleDelete} danger>
            🗑 ลบรูปถาวร
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
        danger
          ? "text-rose-600 dark:text-rose-400"
          : "text-zinc-700 dark:text-zinc-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── Tab + View helpers ───────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={[
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

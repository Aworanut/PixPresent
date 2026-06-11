"use client";

import { useState, useTransition, useRef, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  setPhotoVisibility,
  setPhotosVisibility,
  deletePhoto,
  deletePhotos,
  type PhotoVisibility,
} from "@/lib/actions/photos";
import { PersonPickerModal, type FilterPayload, type EnrollPayload } from "./_person-ban-modal";
import { enrollPersonAction } from "@/lib/actions/people";
import { deriveFolderView } from "@/lib/archive/folder-view";
import { PhotoBadge } from "@/components/ui/photo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PhotoIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  GlobeAltIcon,
  UserIcon,
  EyeSlashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  FolderIcon,
  ChevronRightIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

type FaceDetail = {
  face_id: string;
  bbox: { left: number; top: number; width: number; height: number };
};

export type GalleryPhoto = {
  id: string;
  r2_web_url: string | null;
  visibility: PhotoVisibility;
  face_details: FaceDetail[];
  storage_file_id: string;
  original_filename: string | null;
  taken_at: string | null;
  photographer_name: string | null;
  copyright: string | null;
  folder_path: string;
};

type Tab = "active" | "hidden";
type View = "grid" | "list";
type FaceFilter = "all" | "0" | "1" | "2" | "3+";

type Props = {
  eventId: string;
  eventName: string;
  photos: GalleryPhoto[];
};

// ─── Design system tokens ─────────────────────────────────────────────────────
// Champagne gold: #D4AF37 | Cream: #F5EEDC | Obsidian: #111111

export function PhotoGallery({ eventId, eventName, photos }: Props) {
  const [tab, setTab] = useState<Tab>("active");
  const [view, setView] = useState<View>("grid");
  const [faceFilter, setFaceFilter] = useState<FaceFilter>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  // Lightbox State
  const [activePhotoIdx, setActivePhotoIdx] = useState<number | null>(null);

  // Person filter: narrow the gallery to one person's photos (issue #22)
  const [personFilter, setPersonFilter] = useState<FilterPayload | null>(null);

  // File-explorer navigation (archive folder browse). `path` lives in the URL
  // (?path=) via the native History API so browser back/forward, refresh, and
  // shared folder links work — and since every photo is already loaded here,
  // pushState filters client-side with no server refetch.
  const searchParams = useSearchParams();
  const path = searchParams.get("path") ?? "";
  const setPath = (p: string) => {
    const params = new URLSearchParams(window.location.search);
    if (p) params.set("path", p);
    else params.delete("path");
    const qs = params.toString();
    window.history.pushState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const [flat, setFlat] = useState(false); // true = ignore folders, show whole event

  // Tab split
  const activePhotos = photos.filter((p) => p.visibility !== "hidden");
  const hiddenPhotos = photos.filter((p) => p.visibility === "hidden");
  const tabPhotos = tab === "active" ? activePhotos : hiddenPhotos;

  // Folder view derived from the tab-filtered photos (archive folder browse).
  const { subfolders, photosHere } = deriveFolderView(tabPhotos, path);
  // Folder mode → grid shows photos in THIS folder; flat mode → whole event.
  const scoped = flat ? tabPhotos : photosHere;

  // Face count filter + person filter (issue #22) — intersect on the scoped set.
  const visible = scoped
    .filter((p) => {
      if (faceFilter === "all") return true;
      const n = p.face_details.length;
      if (faceFilter === "0") return n === 0;
      if (faceFilter === "1") return n === 1;
      if (faceFilter === "2") return n === 2;
      if (faceFilter === "3+") return n >= 3;
      return true;
    })
    .filter((p) => !personFilter || personFilter.photoIds.has(p.id));

  // Clear selection and close lightbox when tab/filter/folder changes — adjust
  // state during render (React's recommended alternative to a reset effect).
  const tabFilterKey = `${tab}|${faceFilter}|${personFilter?.faceId ?? ""}|${flat ? "flat" : path}`;
  const [prevTabFilterKey, setPrevTabFilterKey] = useState(tabFilterKey);
  if (prevTabFilterKey !== tabFilterKey) {
    setPrevTabFilterKey(tabFilterKey);
    setSelectedIds(new Set());
    setActivePhotoIdx(null);
  }

  const handleClose = () => setActivePhotoIdx(null);

  const handlePrev = () => {
    setActivePhotoIdx((prev) => {
      if (prev === null || visible.length === 0) return null;
      return (prev - 1 + visible.length) % visible.length;
    });
  };

  const handleNext = () => {
    setActivePhotoIdx((prev) => {
      if (prev === null || visible.length === 0) return null;
      return (prev + 1) % visible.length;
    });
  };

  const handleSetVisibility = async (photoId: string, v: PhotoVisibility) => {
    if (tab === "active" && v === "hidden") {
      if (visible.length <= 1) {
        handleClose();
      } else {
        setActivePhotoIdx((prev) => {
          if (prev === null) return null;
          return prev >= visible.length - 1 ? visible.length - 2 : prev;
        });
      }
    }
    await setPhotoVisibility(photoId, eventId, v);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (visible.length <= 1) {
      handleClose();
    } else {
      setActivePhotoIdx((prev) => {
        if (prev === null) return null;
        return prev >= visible.length - 1 ? visible.length - 2 : prev;
      });
    }
    await deletePhoto(photoId, eventId);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(visible.map((p) => p.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  const selectedList = [...selectedIds];
  const allSelected = visible.length > 0 && selectedIds.size === visible.length;

  const bulkSet = (v: PhotoVisibility) => () => {
    const label = v === "public" ? "เผยแพร่ทั้งหมด" : v === "match_only" ? "เฉพาะใบหน้าตรง" : "ไม่เผยแพร่";
    if (!window.confirm(`เปลี่ยน ${selectedIds.size} รูปเป็น "${label}"?`)) return;
    startBulkTransition(async () => {
      await setPhotosVisibility(selectedList, eventId, v);
      clearSelection();
    });
  };

  const bulkDelete = () => {
    if (!window.confirm(`ลบ ${selectedIds.size} รูปถาวร? ไม่สามารถกู้คืนได้`)) return;
    startBulkTransition(async () => {
      await deletePhotos(selectedList, eventId);
      clearSelection();
    });
  };

  return (
    <div className="space-y-3">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
          <TabButton active={tab === "active"} onClick={() => setTab("active")}>
            ทั้งหมด ({activePhotos.length})
          </TabButton>
          <TabButton active={tab === "hidden"} onClick={() => setTab("hidden")}>
            ไม่เผยแพร่ {hiddenPhotos.length > 0 && `(${hiddenPhotos.length})`}
          </TabButton>
        </div>

        <div className="flex items-center gap-2">
          {/* Select toggle */}
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={[
              "px-3 py-1 rounded-md text-sm font-medium transition-all duration-300",
              selectMode
                ? "bg-[#111111] dark:bg-[#FBF9F6] text-[#FBF9F6] dark:text-[#111111]"
                : "border border-[rgba(17,17,17,0.2)] dark:border-[rgba(251,249,246,0.2)] text-zinc-600 dark:text-zinc-400 hover:border-[#D4AF37] hover:text-[#111111] dark:hover:text-[#FBF9F6] bg-transparent",
            ].join(" ")}
          >
            {selectMode ? "ยกเลิก" : "เลือก"}
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
            <ViewToggle active={view === "grid"} onClick={() => setView("grid")} label="Grid view">
              <GridIcon />
            </ViewToggle>
            <ViewToggle active={view === "list"} onClick={() => setView("list")} label="List view">
              <ListIcon />
            </ViewToggle>
          </div>
        </div>
      </div>

      {/* ── Face count filter ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">ใบหน้า</span>
        {(["all", "0", "1", "2", "3+"] as FaceFilter[]).map((f) => {
          const label = f === "all" ? "ทั้งหมด" : f === "0" ? "ไม่มีคน" : f === "3+" ? "3+ คน" : `${f} คน`;
          const count = f === "all" ? tabPhotos.length
            : f === "0" ? tabPhotos.filter(p => p.face_details.length === 0).length
            : f === "1" ? tabPhotos.filter(p => p.face_details.length === 1).length
            : f === "2" ? tabPhotos.filter(p => p.face_details.length === 2).length
            : tabPhotos.filter(p => p.face_details.length >= 3).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFaceFilter(f)}
              className={[
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300",
                faceFilter === f
                  ? "bg-[#111111] dark:bg-[#FBF9F6] text-[#FBF9F6] dark:text-[#111111]"
                  : "border border-[rgba(17,17,17,0.15)] dark:border-[rgba(251,249,246,0.15)] text-zinc-500 dark:text-zinc-400 hover:border-[#D4AF37] hover:text-zinc-900 dark:hover:text-zinc-100 bg-transparent",
              ].join(" ")}
            >
              {label} <span className="opacity-50">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selectMode && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[rgba(212,175,55,0.3)] bg-[#F5EEDC]/40 dark:bg-[#27272A]/60 flex-wrap">
          {/* Select all */}
          <button
            type="button"
            onClick={allSelected ? clearSelection : selectAll}
            className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium shrink-0"
          >
            <Checkbox checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} />
            {selectedIds.size > 0 ? `เลือกอยู่ ${selectedIds.size} รูป` : "เลือกทั้งหมด"}
          </button>

          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <HairlineButton onClick={bulkSet("public")} disabled={bulkPending}>
                <span className="flex items-center gap-1">
                  <GlobeAltIcon className="h-3.5 w-3.5 stroke-[1.5] text-zinc-400 dark:text-zinc-500" />
                  <span>เผยแพร่ทั้งหมด</span>
                </span>
              </HairlineButton>
              <HairlineButton onClick={bulkSet("match_only")} disabled={bulkPending}>
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5 stroke-[1.5] text-zinc-400 dark:text-zinc-500" />
                  <span>เฉพาะใบหน้าตรง</span>
                </span>
              </HairlineButton>
              <HairlineButton onClick={bulkSet("hidden")} disabled={bulkPending}>
                <span className="flex items-center gap-1">
                  <EyeSlashIcon className="h-3.5 w-3.5 stroke-[1.5] text-zinc-400 dark:text-zinc-500" />
                  <span>ไม่เผยแพร่</span>
                </span>
              </HairlineButton>
              <HairlineButton onClick={bulkDelete} disabled={bulkPending} danger>
                <span className="flex items-center gap-1">
                  <TrashIcon className="h-3.5 w-3.5 stroke-[1.5] text-zinc-600 dark:text-zinc-400 group-hover:text-rose-600 dark:group-hover:text-rose-400" />
                  <span>ลบ</span>
                </span>
              </HairlineButton>
            </div>
          )}
        </div>
      )}

      {/* ── Active person filter chip (issue #22) ───────────────────────────── */}
      {personFilter && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-[rgba(212,175,55,0.3)]">
          {/* Face thumbnail — crop the ref face from its source photo via bbox */}
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-700">
            {personFilter.sourceUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={personFilter.sourceUrl}
                alt=""
                className="absolute max-w-none"
                style={{
                  width: `${(1 / personFilter.bbox.width) * 28}px`,
                  left: `${-(personFilter.bbox.left / personFilter.bbox.width) * 28}px`,
                  top: `${-(personFilter.bbox.top / personFilter.bbox.width) * 28}px`,
                }}
              />
            )}
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            กรองตามใบหน้า · เจอ {visible.length} รูป
          </span>
          <button
            type="button"
            onClick={() => setPersonFilter(null)}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="ล้างตัวกรองใบหน้า"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Folder explorer header (archive folder browse) ───────────────────── */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {flat ? (
          <span className="text-zinc-500 dark:text-zinc-400">ทุกรูปในงานนี้</span>
        ) : (
          <nav className="flex items-center gap-1 flex-wrap">
            <Link
              href="/dashboard"
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              คลัง
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-400" />
            <button
              type="button"
              onClick={() => setPath("")}
              className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
            >
              {eventName}
            </button>
            {path
              .split("/")
              .filter(Boolean)
              .map((seg, i, arr) => {
                const target = arr.slice(0, i + 1).join("/");
                return (
                  <span key={target} className="flex items-center gap-1">
                    <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-400" />
                    <button
                      type="button"
                      onClick={() => setPath(target)}
                      className="text-zinc-600 dark:text-zinc-300 hover:text-[#D4AF37] transition-colors"
                    >
                      {seg}
                    </button>
                  </span>
                );
              })}
          </nav>
        )}
        <button
          type="button"
          onClick={() => setFlat((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:border-[#D4AF37] transition-colors"
        >
          <Squares2X2Icon className="h-3.5 w-3.5" />
          {flat ? "ดูเป็นแฟ้ม" : "ดูรวมทั้งงาน"}
        </button>
      </div>

      {/* Subfolder tiles (folder mode only) */}
      {!flat && subfolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {subfolders.map((sf) => (
            <button
              key={sf.path}
              type="button"
              onClick={() => setPath(sf.path)}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-left hover:border-[#D4AF37] transition-colors"
            >
              <FolderIcon className="h-8 w-8 shrink-0 text-[#D4AF37]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{sf.name}</p>
                <p className="text-xs text-zinc-400">{sf.count} รูป</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {visible.length === 0 && subfolders.length === 0 && (
        <EmptyState
          icon={PhotoIcon}
          message={
            personFilter
              ? "บุคคลนี้ไม่มีรูปในแท็บนี้ — ลองสลับแท็บ หรือกด ✕ ล้างตัวกรอง"
              : !flat && path !== ""
                ? "แฟ้มนี้ไม่มีรูป"
                : tab === "hidden"
                  ? "ยังไม่มีรูปที่ไม่เผยแพร่"
                  : "ยังไม่มีรูป"
          }
        />
      )}

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      {view === "grid" && visible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {visible.map((photo, idx) => (
            <GridCard
              key={photo.id}
              photo={photo}
              eventId={eventId}
              onApplyPersonFilter={setPersonFilter}
              selectMode={selectMode}
              selected={selectedIds.has(photo.id)}
              onToggleSelect={toggleSelect}
              onViewPhoto={() => setActivePhotoIdx(idx)}
            />
          ))}
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {view === "list" && visible.length > 0 && (
        <div className="rounded-lg border border-[rgba(17,17,17,0.1)] dark:border-[rgba(251,249,246,0.1)] bg-white dark:bg-zinc-900 divide-y divide-[rgba(17,17,17,0.06)] dark:divide-[rgba(251,249,246,0.06)]">
          {visible.map((photo, idx) => (
            <ListRow
              key={photo.id}
              photo={photo}
              eventId={eventId}
              onApplyPersonFilter={setPersonFilter}
              selectMode={selectMode}
              selected={selectedIds.has(photo.id)}
              onToggleSelect={toggleSelect}
              onViewPhoto={() => setActivePhotoIdx(idx)}
            />
          ))}
        </div>
      )}

      {/* ── Lightbox Modal ── */}
      {activePhotoIdx !== null && visible[activePhotoIdx] && (
        <Lightbox
          photo={visible[activePhotoIdx]}
          index={activePhotoIdx}
          total={visible.length}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
          onSetVisibility={handleSetVisibility}
          onDelete={handleDeletePhoto}
        />
      )}
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({
  photo,
  eventId,
  onApplyPersonFilter,
  selectMode,
  selected,
  onToggleSelect,
  onViewPhoto,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onViewPhoto: () => void;
}) {
  const faceCount = photo.face_details.length;
  const url = photo.r2_web_url;
  const isHidden = photo.visibility === "hidden";

  return (
    <div
      onClick={selectMode ? () => onToggleSelect(photo.id) : onViewPhoto}
      className={[
        "group relative aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 cursor-pointer",
        isHidden ? "opacity-50" : "",
        selected
          ? "ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
          : "",
      ].join(" ")}
    >
      {/* Image Wrapper to handle rounded corners and image boundary clipping */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
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
          <div className="absolute inset-0 flex items-center justify-center">
            <PhotoIcon className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}

        {/* Selected overlay */}
        {selectMode && selected && (
          <div className="absolute inset-0 bg-[#D4AF37]/10" />
        )}
      </div>

      {/* Checkbox */}
      {selectMode && (
        <div className="absolute top-1.5 left-1.5">
          <Checkbox checked={selected} />
        </div>
      )}

      {/* Visibility badge */}
      {!selectMode && photo.visibility === "public" && (
        <div className="absolute top-1 left-1">
          <VisibilityBadge v="public" />
        </div>
      )}
      {!selectMode && isHidden && (
        <div className="absolute top-1 left-1">
          <VisibilityBadge v="hidden" />
        </div>
      )}

      {/* Face count badge */}
      {!selectMode && faceCount > 0 && (
        <div className="absolute bottom-1 left-1">
          <PhotoBadge variant="face">{faceCount} ใบหน้า</PhotoBadge>
        </div>
      )}

      {/* ⋮ menu */}
      {!selectMode && (
        <div 
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <PhotoMenu photo={photo} eventId={eventId} onApplyPersonFilter={onApplyPersonFilter} />
        </div>
      )}
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────

function ListRow({
  photo,
  eventId,
  onApplyPersonFilter,
  selectMode,
  selected,
  onToggleSelect,
  onViewPhoto,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onViewPhoto: () => void;
}) {
  const faceCount = photo.face_details.length;
  const url = photo.r2_web_url;
  const filename = photo.original_filename || (photo.storage_file_id.split("/").pop() ?? photo.storage_file_id);
  const isHidden = photo.visibility === "hidden";

  return (
    <div
      onClick={selectMode ? () => onToggleSelect(photo.id) : onViewPhoto}
      className={[
        "flex items-center gap-3 px-4 py-2.5 group transition-colors cursor-pointer hover:bg-[#F5EEDC]/30 dark:hover:bg-zinc-800/50",
        isHidden ? "opacity-50" : "",
        selected ? "bg-[#F5EEDC]/50 dark:bg-[#27272A]/60" : "",
      ].join(" ")}
    >
      {selectMode && <Checkbox checked={selected} />}

      {/* Thumbnail */}
      <div className="relative w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {url ? (
          <Image src={url} alt="photo" fill className="object-cover" sizes="40px" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <PhotoIcon className="h-5 w-5 stroke-[1.5]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate font-mono text-xs">
          {filename}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
          {faceCount > 0 ? `${faceCount} ใบหน้า` : "ไม่พบใบหน้า"}
          {" · "}
          <span className={photo.visibility === "public" ? "text-[#D4AF37]" : isHidden ? "text-zinc-400" : ""}>
            {VISIBILITY_LABEL[photo.visibility]}
          </span>
          {photo.photographer_name && ` · ช่างภาพ: ${photo.photographer_name}`}
          {photo.taken_at && ` · ${formatThaiDate(photo.taken_at)}`}
        </p>
      </div>

      {/* ⋮ menu */}
      {!selectMode && (
        <div 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <PhotoMenu photo={photo} eventId={eventId} onApplyPersonFilter={onApplyPersonFilter} />
        </div>
      )}
    </div>
  );
}

// ─── Visibility helpers ───────────────────────────────────────────────────────

const VISIBILITY_LABEL: Record<PhotoVisibility, string> = {
  public: "เผยแพร่ทั้งหมด",
  match_only: "เฉพาะใบหน้าตรง",
  hidden: "ไม่เผยแพร่",
};

function VisibilityBadge({ v }: { v: PhotoVisibility }) {
  if (v === "public") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#D4AF37]/20 text-[#111111] dark:text-[#FBF9F6] backdrop-blur-sm">
        <GlobeAltIcon className="h-3 w-3 stroke-[1.5]" />
      </span>
    );
  }
  if (v === "hidden") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-black/40 text-white backdrop-blur-sm">
        ไม่เผยแพร่
      </span>
    );
  }
  return null;
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      className={[
        "flex h-5 w-5 items-center justify-center rounded border transition-all duration-200 text-xs font-bold shrink-0",
        checked || indeterminate
          ? "bg-[#D4AF37] border-[#D4AF37] text-[#111111]"
          : "bg-white dark:bg-zinc-800 border-[rgba(17,17,17,0.25)] dark:border-[rgba(251,249,246,0.25)]",
      ].join(" ")}
    >
      {indeterminate ? "−" : checked ? "✓" : null}
    </span>
  );
}

// ─── Hairline action button (design system §3.1) ──────────────────────────────

function HairlineButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-2.5 py-1 rounded text-xs font-medium border transition-all duration-300 disabled:opacity-40",
        danger
          ? "border-[rgba(17,17,17,0.2)] dark:border-[rgba(251,249,246,0.2)] text-zinc-600 dark:text-zinc-400 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 bg-transparent"
          : "border-[rgba(17,17,17,0.2)] dark:border-[rgba(251,249,246,0.2)] text-zinc-600 dark:text-zinc-400 hover:border-[#D4AF37] hover:text-zinc-900 dark:hover:text-zinc-100 bg-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── ⋮ Photo menu ─────────────────────────────────────────────────────────────

function PhotoMenu({
  photo,
  eventId,
  onApplyPersonFilter,
}: {
  photo: GalleryPhoto;
  eventId: string;
  onApplyPersonFilter: (payload: FilterPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false);
  const [enrollPayload, setEnrollPayload] = useState<EnrollPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const act = (fn: () => Promise<void>) => {
    setOpen(false);
    startTransition(fn);
  };

  const setVis = (v: PhotoVisibility) =>
    act(() => setPhotoVisibility(photo.id, eventId, v));

  const isHidden = photo.visibility === "hidden";

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
        <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-[rgba(17,17,17,0.1)] dark:border-[rgba(251,249,246,0.1)] bg-white dark:bg-zinc-900 shadow-xl py-1 text-sm">
          {/* Visibility section */}
          <div className="px-3 pt-1.5 pb-1">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">การเผยแพร่</p>
          </div>
          <MenuItem
            onClick={() => setVis("public")}
            active={photo.visibility === "public"}
            icon={GlobeAltIcon}
          >
            เผยแพร่ทั้งหมด
          </MenuItem>
          <MenuItem
            onClick={() => setVis("match_only")}
            active={photo.visibility === "match_only"}
            icon={UserIcon}
          >
            เฉพาะใบหน้าตรง
          </MenuItem>
          <MenuItem
            onClick={() => setVis("hidden")}
            active={photo.visibility === "hidden"}
            icon={EyeSlashIcon}
          >
            ไม่เผยแพร่
          </MenuItem>

          <div className="my-1 border-t border-[rgba(17,17,17,0.06)] dark:border-[rgba(251,249,246,0.06)]" />

          {photo.face_details.length > 0 && (
            <>
              <MenuItem
                onClick={() => { setOpen(false); setPickerOpen(true); }}
                icon={isHidden ? EyeIcon : EyeSlashIcon}
              >
                {isHidden ? "แสดงบุคคล" : "ซ่อนบุคคล"}
              </MenuItem>
              <MenuItem
                onClick={() => { setOpen(false); setFilterPickerOpen(true); }}
                icon={MagnifyingGlassIcon}
              >
                ดูเฉพาะรูปของคนนี้
              </MenuItem>
              <MenuItem
                onClick={() => { setOpen(false); setEnrollPickerOpen(true); }}
                icon={UserPlusIcon}
              >
                บันทึกเป็นบุคคล
              </MenuItem>
            </>
          )}

          <div className="my-1 border-t border-[rgba(17,17,17,0.06)] dark:border-[rgba(251,249,246,0.06)]" />

          <MenuItem onClick={handleDelete} danger icon={TrashIcon}>
            ลบรูปถาวร
          </MenuItem>
        </div>
      )}

      {/* Person picker → preview → ban (rendered to body so the card's
          group-hover opacity wrapper can't fade the modal out) */}
      {pickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <PersonPickerModal
            eventId={eventId}
            photo={photo}
            mode={isHidden ? "unhide" : "hide"}
            onClose={() => setPickerOpen(false)}
          />,
          document.body,
        )}

      {/* Person filter picker (issue #22) — picks a face, hands ids to the gallery */}
      {filterPickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <PersonPickerModal
            eventId={eventId}
            photo={photo}
            mode="filter"
            onClose={() => setFilterPickerOpen(false)}
            onApplyFilter={(payload) => {
              onApplyPersonFilter(payload);
              setFilterPickerOpen(false);
            }}
          />,
          document.body,
        )}

      {/* Enroll picker (issue #24) — pick a face → name modal → create person */}
      {enrollPickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <PersonPickerModal
            eventId={eventId}
            photo={photo}
            mode="enroll"
            onClose={() => setEnrollPickerOpen(false)}
            onApplyEnroll={(payload) => {
              setEnrollPayload(payload);
              setEnrollPickerOpen(false);
            }}
          />,
          document.body,
        )}

      {enrollPayload &&
        typeof document !== "undefined" &&
        createPortal(
          <EnrollModal payload={enrollPayload} onClose={() => setEnrollPayload(null)} />,
          document.body,
        )}
    </div>
  );
}

// ─── Enroll modal (issue #24) ───────────────────────────────────────────────
// Names the picked face and creates the person via enrollPersonAction. The
// crop + backfill scan happen server-side; the key is derived from the photo id.

function EnrollModal({
  payload,
  onClose,
}: {
  payload: EnrollPayload;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("sourcePhotoId", payload.sourcePhotoId);
        fd.set("bbox", JSON.stringify(payload.bbox));
        await enrollPersonAction(fd);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
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
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-xs tracking-widest uppercase text-zinc-400">บันทึกเป็นบุคคล</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อ-นามสกุล"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          autoFocus
          required
        />
        <p className="text-xs text-zinc-500">
          ระบบจะค้นหารูปของคนนี้ในทุกงานให้อัตโนมัติ
        </p>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-transparent text-xs font-mono tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all disabled:opacity-40"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="px-4 py-1.5 rounded text-xs font-mono tracking-wider font-semibold bg-[#D4AF37] text-black hover:bg-[#c49f2e] transition-all disabled:opacity-60"
          >
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  active,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 hover:bg-[#F5EEDC]/60 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between gap-2",
        danger
          ? "text-rose-600 dark:text-rose-400"
          : "text-zinc-700 dark:text-zinc-300",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 stroke-[1.5] ${danger ? "text-rose-600 dark:text-rose-400" : "text-zinc-400 dark:text-zinc-500"}`} />}
        <span>{children}</span>
      </span>
      {active && <span className="text-[#D4AF37] text-xs">✓</span>}
    </button>
  );
}

// ─── Tab / View helpers ───────────────────────────────────────────────────────

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

// ─── Lightbox Component ───────────────────────────────────────────────────────

type LightboxProps = {
  photo: GalleryPhoto;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSetVisibility: (id: string, v: PhotoVisibility) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function Lightbox({
  photo,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onSetVisibility,
  onDelete,
}: LightboxProps) {
  const [isPending, startTransition] = useTransition();
  const [isImgLoading, setIsImgLoading] = useState(true);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset image loading state when the photo changes — adjust during render.
  const [prevPhotoId, setPrevPhotoId] = useState(photo.id);
  if (prevPhotoId !== photo.id) {
    setPrevPhotoId(photo.id);
    setIsImgLoading(true);
  }

  // Clear any pending image-load timeout when the photo changes or on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [photo.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setDirection("left");
        onPrev();
      } else if (e.key === "ArrowRight") {
        setDirection("right");
        onNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrev, onNext, onClose]);

  const url = photo.r2_web_url;

  const handleDelete = () => {
    if (!window.confirm("ลบรูปนี้ถาวร? ไม่สามารถกู้คืนได้")) return;
    startTransition(async () => {
      await onDelete(photo.id);
    });
  };

  const handleSetVis = (v: PhotoVisibility) => {
    startTransition(async () => {
      await onSetVisibility(photo.id, v);
    });
  };

  const metadataParts = [];
  if (photo.photographer_name) {
    metadataParts.push(photo.photographer_name);
  }
  if (photo.taken_at) {
    const formatted = formatThaiDate(photo.taken_at);
    if (formatted) metadataParts.push(formatted);
  }
  if (photo.copyright) {
    const hasSymbol = photo.copyright.includes("©") || photo.copyright.toLowerCase().includes("copyright");
    metadataParts.push(hasSymbol ? photo.copyright : `© ${photo.copyright}`);
  }
  const metadataStr = metadataParts.join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md transition-all duration-300">
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        {/* Photo index counter & metadata */}
        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs text-zinc-400 tracking-widest uppercase">
            IMAGE {index + 1} OF {total}
          </div>
          {metadataStr && (
            <div className="font-mono text-[10px] text-zinc-500 tracking-wider">
              {metadataStr}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors duration-200"
          aria-label="Close"
        >
          <XMarkIcon className="h-6 w-6 stroke-[1.5]" />
        </button>
      </div>

      {/* Main Image View + Navigation Controls */}
      <div className="relative flex-1 flex items-center justify-center px-4 sm:px-12 md:px-20">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => {
            setDirection("left");
            onPrev();
          }}
          className="absolute left-2 sm:left-4 md:left-6 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white transition-all duration-200 border border-zinc-800/50 hover:border-zinc-700/50 shadow-lg"
          aria-label="Previous image"
        >
          <ArrowLeftIcon className="h-6 w-6 stroke-[1.5]" />
        </button>

        {/* The Image Wrapper */}
        <div className="relative w-full h-full max-h-[70vh] flex items-center justify-center select-none overflow-hidden">
          {url ? (
            <>
              {isImgLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-300">
                  {/* Premium, delicate champagne gold circular spinner */}
                  <div className="h-10 w-10 rounded-full border-2 border-zinc-800/80 border-t-[#D4AF37] animate-spin" />
                </div>
              )}
              <Image
                key={photo.id}
                src={url}
                alt={`Event photo ${index + 1}`}
                fill
                className={`object-contain transition-all duration-[800ms] ease-out ${
                  isImgLoading
                    ? `opacity-0 scale-[0.98] blur-sm ${
                        direction === "right"
                          ? "translate-x-8"
                          : direction === "left"
                          ? "-translate-x-8"
                          : "translate-x-0"
                      }`
                    : "opacity-100 scale-100 blur-0 translate-x-0"
                }`}
                sizes="100vw"
                priority
                onLoad={() => {
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                  timeoutRef.current = setTimeout(() => {
                    setIsImgLoading(false);
                  }, 40); // Small 40ms paint-tick timeout to ensure browser paints loading state first
                }}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <PhotoIcon className="h-12 w-12 stroke-[1]" />
              <span className="text-sm font-mono tracking-wider">NO IMAGE DATA</span>
            </div>
          )}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => {
            setDirection("right");
            onNext();
          }}
          className="absolute right-2 sm:right-4 md:right-6 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white transition-all duration-200 border border-zinc-800/50 hover:border-zinc-700/50 shadow-lg"
          aria-label="Next image"
        >
          <ArrowRightIcon className="h-6 w-6 stroke-[1.5]" />
        </button>
      </div>

      {/* Bottom Controls / Action Bar */}
      <div className="w-full bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-4 pb-6 px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 z-10">
        {/* Visibility Toggles */}
        <div className="flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 p-1">
          {(["public", "match_only", "hidden"] as PhotoVisibility[]).map((v) => {
            const label = v === "public" ? "PUBLIC" : v === "match_only" ? "MATCH ONLY" : "HIDDEN";
            const isActive = photo.visibility === v;
            return (
              <button
                key={v}
                type="button"
                disabled={isPending}
                onClick={() => handleSetVis(v)}
                className={[
                  "px-3 py-1 font-mono text-[10px] tracking-wider transition-all duration-300 rounded",
                  isActive
                    ? "bg-[#D4AF37] text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Download & Delete Quick Actions */}
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50 text-xs font-medium text-zinc-300 hover:text-white transition-all duration-300"
            >
              <ArrowDownTrayIcon className="h-4 w-4 stroke-[1.5]" />
              <span>DOWNLOAD</span>
            </a>
          )}
          
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900 hover:border-rose-950/50 hover:bg-rose-950/20 hover:text-rose-400 text-xs font-medium text-zinc-400 transition-all duration-300 disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4 stroke-[1.5]" />
            <span>DELETE</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Localized Thai date helper ──────────────────────────────────────────────

function formatThaiDate(isoString: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${datePart} ${timePart}`;
  } catch {
    return "";
  }
}

"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PhotoBadge } from "@/components/ui/photo-badge";
import { addToBlacklist, removeFromBlacklist } from "@/lib/actions/blacklist";

type BBox = { left: number; top: number; width: number; height: number };
type FaceDetail = { face_id: string; bbox: BBox };

type Photo = {
  id: string;
  r2_web_url: string;
  face_details: FaceDetail[];
  blockedFaceIds: Set<string>;
};

type Props = {
  eventId: string;
  photos: Photo[];
};

export function PhotoViewer({ eventId, photos }: Props) {
  const [selected, setSelected] = useState<Photo | null>(null);

  // Shared blocked set across ALL modals — initialized from page-load snapshot.
  // Lifted here so toggling in one modal is immediately reflected
  // when opening another modal for a photo with the same face.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(
    () => new Set(photos[0]?.blockedFaceIds ?? []),
  );

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((photo) => {
          // Use shared state — reflects live toggles made in any previous modal
          const blockedCount = photo.face_details.filter((f) =>
            blockedIds.has(f.face_id),
          ).length;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelected(photo)}
              className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <Image
                src={photo.r2_web_url}
                alt="event photo"
                fill
                className="object-cover group-hover:opacity-90 transition-opacity"
                sizes="(max-width: 640px) 50vw, 25vw"
              />
              {/* Face count badge */}
              {photo.face_details.length > 0 && (
                <div className="absolute bottom-1 left-1 flex gap-1">
                  <PhotoBadge variant="face">{photo.face_details.length} ใบหน้า</PhotoBadge>
                  {blockedCount > 0 && (
                    <PhotoBadge variant="blocked">{blockedCount} บล็อก</PhotoBadge>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Viewer modal */}
      {selected && (
        <FaceViewerModal
          eventId={eventId}
          photo={selected}
          blockedIds={blockedIds}
          onBlockedChange={setBlockedIds}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function FaceViewerModal({
  eventId,
  photo,
  blockedIds,
  onBlockedChange,
  onClose,
}: {
  eventId: string;
  photo: Photo;
  blockedIds: Set<string>;
  onBlockedChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = (faceId: string) => {
    startTransition(async () => {
      if (blockedIds.has(faceId)) {
        await removeFromBlacklist(eventId, faceId);
        onBlockedChange((prev) => {
          const next = new Set(prev);
          next.delete(faceId);
          return next;
        });
      } else {
        await addToBlacklist(eventId, faceId);
        onBlockedChange((prev) => new Set(prev).add(faceId));
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-xl overflow-hidden max-w-2xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-white bg-black/50 hover:bg-black/70 rounded-full w-7 h-7 flex items-center justify-center text-sm"
        >
          ✕
        </button>

        {/* Image with bounding boxes */}
        <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
          <Image
            src={photo.r2_web_url}
            alt="event photo"
            fill
            className="object-contain"
            sizes="672px"
          />

          {/* Bounding boxes — use shared blockedIds */}
          {photo.face_details.map((face) => {
            const isBlocked = blockedIds.has(face.face_id);
            return (
              <button
                key={face.face_id}
                type="button"
                disabled={pending}
                onClick={() => toggle(face.face_id)}
                title={isBlocked ? "คลิกเพื่อปลดบล็อก" : "คลิกเพื่อบล็อกใบหน้านี้"}
                style={{
                  position: "absolute",
                  left: `${face.bbox.left * 100}%`,
                  top: `${face.bbox.top * 100}%`,
                  width: `${face.bbox.width * 100}%`,
                  height: `${face.bbox.height * 100}%`,
                }}
                className={[
                  "border-2 rounded transition-colors cursor-pointer",
                  isBlocked
                    ? "border-rose-500 bg-rose-500/20 hover:bg-rose-500/30"
                    : "border-emerald-400 bg-transparent hover:bg-emerald-400/20",
                ].join(" ")}
              />
            );
          })}
        </div>

        {/* Face list */}
        {photo.face_details.length > 0 ? (
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              ใบหน้าในรูป — คลิกกล่องสีเขียวเพื่อบล็อก
            </p>
            <div className="flex flex-wrap gap-2">
              {photo.face_details.map((face) => {
                const isBlocked = blockedIds.has(face.face_id);
                return (
                  <Button
                    key={face.face_id}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => toggle(face.face_id)}
                    className={
                      isBlocked
                        ? "text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        : "text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    {isBlocked ? "🚫 ปลดบล็อก" : "บล็อกใบหน้านี้"}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              ไม่พบข้อมูล bounding box — Re-sync เพื่ออัปเดต
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

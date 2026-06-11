"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findMatchingFacesByFaceId, type FaceMatchPreview } from "@/lib/actions/blacklist";
import { setPhotosVisibility } from "@/lib/actions/photos";

type FaceDetail = {
  face_id: string;
  bbox: { left: number; top: number; width: number; height: number };
};

// Payload emitted when a face is picked in mode="filter" — drives the gallery's
// "ดูเฉพาะรูปของคนนี้" filter (issue #22). Shape mirrors person_reference_faces
// fields so a future "บันทึกเป็นบุคคล" enrollment can reuse it directly.
export type FilterPayload = {
  faceId: string;
  sourcePhotoId: string;
  bbox: { left: number; top: number; width: number; height: number };
  sourceUrl: string | null;
  photoIds: Set<string>;
};

// Emitted when a face is picked in mode="enroll" — drives "บันทึกเป็นบุคคล".
// Shape matches person_reference_faces (source='tagged'); the R2 key is derived
// server-side from sourcePhotoId, so none is carried here.
export type EnrollPayload = {
  faceId: string;
  sourcePhotoId: string;
  bbox: { left: number; top: number; width: number; height: number };
};

type BanMode = "hide" | "unhide";
type Mode = BanMode | "filter" | "enroll";

// ─── PersonPickerModal ────────────────────────────────────────────────────────
// Stage 1: pick a face from this photo. Stage 2: preview that person's photos
// across the event, then hide (mode="hide") or bring back (mode="unhide") them.

export function PersonPickerModal({
  eventId,
  photo,
  mode,
  onClose,
  onApplyFilter,
  onApplyEnroll,
}: {
  eventId: string;
  photo: { id: string; r2_web_url: string | null; face_details: FaceDetail[] };
  mode: Mode;
  onClose: () => void;
  onApplyFilter?: (payload: FilterPayload) => void;
  onApplyEnroll?: (payload: EnrollPayload) => void;
}) {
  const [searching, startSearch] = useTransition();
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<FaceMatchPreview[] | null>(null);

  const pickFace = (face: FaceDetail) => {
    setActiveFaceId(face.face_id);
    // Enroll just needs the picked face — no similarity search required.
    if (mode === "enroll") {
      onApplyEnroll?.({
        faceId: face.face_id,
        sourcePhotoId: photo.id,
        bbox: face.bbox,
      });
      onClose();
      return;
    }
    startSearch(async () => {
      const result = await findMatchingFacesByFaceId(eventId, face.face_id);
      // mode="filter": hand the matched photo ids back to the gallery and close,
      // skipping the hide/unhide preview stage entirely.
      if (mode === "filter") {
        onApplyFilter?.({
          faceId: face.face_id,
          sourcePhotoId: photo.id,
          bbox: face.bbox,
          sourceUrl: photo.r2_web_url,
          photoIds: new Set(result.map((r) => r.photoId)),
        });
        onClose();
        return;
      }
      setPreviews(result);
    });
  };

  // Stage 2 — preview the picked person's photos (only in hide/unhide mode;
  // filter and enroll short-circuit in pickFace and never set previews).
  if (previews && mode !== "filter" && mode !== "enroll") {
    return (
      <FaceMatchPreviewModal
        eventId={eventId}
        previews={previews}
        mode={mode}
        onClose={() => {
          // Back to the face picker so a different person can be chosen.
          setPreviews(null);
          setActiveFaceId(null);
        }}
        onConfirmed={onClose}
      />
    );
  }

  // Stage 1 — pick a face
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest uppercase text-zinc-400">
            {mode === "hide"
              ? "เลือกบุคคลที่จะซ่อน"
              : mode === "filter"
                ? "เลือกใบหน้าที่จะกรอง"
                : mode === "enroll"
                  ? "เลือกใบหน้าเพื่อบันทึกเป็นบุคคล"
                  : "เลือกบุคคลที่จะแสดง"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-center bg-zinc-800 p-3">
          {photo.r2_web_url && (
            // Wrapper shrink-wraps the image (w-fit) so bbox fractions map 1:1
            // with no object-contain letterbox skew.
            <div className="relative w-fit max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.r2_web_url}
                alt="event photo"
                className="block max-h-[65vh] max-w-full w-auto rounded"
              />
              {photo.face_details.map((face, idx) => {
                const isActive = activeFaceId === face.face_id;
                return (
                  <button
                    key={face.face_id}
                    type="button"
                    disabled={searching}
                    onClick={() => pickFace(face)}
                    title="คลิกเพื่อดูรูปของคนนี้"
                    style={{
                      position: "absolute",
                      left: `${face.bbox.left * 100}%`,
                      top: `${face.bbox.top * 100}%`,
                      width: `${face.bbox.width * 100}%`,
                      height: `${face.bbox.height * 100}%`,
                    }}
                    className={[
                      "border-2 rounded transition-colors cursor-pointer disabled:cursor-wait",
                      isActive
                        ? "border-[#D4AF37] bg-[#D4AF37]/30 animate-pulse"
                        : "border-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/30",
                    ].join(" ")}
                  >
                    <span className="absolute -top-2.5 -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-black shadow">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {mode === "filter"
              ? "คลิกใบหน้าเพื่อกรองรูปของคนนั้น"
              : mode === "enroll"
                ? "คลิกใบหน้าเพื่อบันทึกเป็นบุคคล"
                : "คลิกใบหน้าเพื่อดูรูปของคนนั้น"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-transparent text-xs font-mono tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all shrink-0"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FaceMatchPreviewModal ────────────────────────────────────────────────────
// Confirm sets the affected photos' visibility: "hidden" (mode=hide, removes them
// from all guest results → "ไม่เผยแพร่" tab) or "match_only" (mode=unhide, restore).

const COPY = {
  hide: {
    empty: "ไม่พบรูปที่จะซ่อน",
    found: (n: number) => `จะซ่อน ${n} รูปของคนนี้`,
    note: "รูปเหล่านี้จะถูกซ่อนจากทุกคน — ย้ายไปแท็บ ไม่เผยแพร่",
    confirm: (n: number) => `ซ่อน ${n} รูป`,
    pending: "กำลังซ่อน...",
    box: "border-rose-500 bg-rose-500/15",
  },
  unhide: {
    empty: "ไม่พบรูปที่ซ่อนไว้",
    found: (n: number) => `จะแสดง ${n} รูปของคนนี้อีกครั้ง`,
    note: "รูปเหล่านี้จะกลับมาแสดง (เฉพาะใบหน้าตรง)",
    confirm: (n: number) => `แสดง ${n} รูป`,
    pending: "กำลังแสดง...",
    box: "border-emerald-500 bg-emerald-500/15",
  },
} as const;

export function FaceMatchPreviewModal({
  eventId,
  previews,
  mode,
  onClose,
  onConfirmed,
}: {
  eventId: string;
  previews: FaceMatchPreview[];
  mode: BanMode;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = COPY[mode];

  // Only photos that will actually change state.
  const affected = previews.filter((p) =>
    mode === "hide" ? p.visibility !== "hidden" : p.visibility === "hidden",
  );

  const handleConfirm = () => {
    const photoIds = Array.from(new Set(affected.map((p) => p.photoId)));
    if (photoIds.length === 0) return;
    startTransition(async () => {
      await setPhotosVisibility(photoIds, eventId, mode === "hide" ? "hidden" : "match_only");
      router.refresh();
      onConfirmed();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest uppercase text-zinc-400">
            {affected.length === 0 ? t.empty : t.found(affected.length)}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Note + grid */}
        {affected.length > 0 && (
          <>
            <p className="px-5 pt-3 text-xs text-zinc-400">{t.note}</p>
            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
              {affected.map((p) => (
                <PreviewTile key={p.photoId} preview={p} boxClass={t.box} />
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-transparent text-xs font-mono tracking-wider text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all disabled:opacity-40"
          >
            CANCEL
          </button>

          {affected.length > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="px-4 py-1.5 rounded text-xs font-mono tracking-wider font-semibold transition-all bg-[#D4AF37] text-black hover:bg-[#c49f2e] disabled:opacity-60"
            >
              {pending ? t.pending : t.confirm(affected.length)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview tile ─────────────────────────────────────────────────────────────

function PreviewTile({ preview, boxClass }: { preview: FaceMatchPreview; boxClass: string }) {
  return (
    <div className="relative rounded-md overflow-hidden bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview.r2_web_url}
        alt="matched face"
        className="w-full h-auto block"
        loading="lazy"
      />
      {preview.bbox && (
        <div
          className={`absolute border-2 pointer-events-none ${boxClass}`}
          style={{
            left: `${preview.bbox.left * 100}%`,
            top: `${preview.bbox.top * 100}%`,
            width: `${preview.bbox.width * 100}%`,
            height: `${preview.bbox.height * 100}%`,
          }}
        />
      )}
    </div>
  );
}

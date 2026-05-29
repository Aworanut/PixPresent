"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCroppedPreviewUrl } from "@/lib/crop-preview";
import type { CropPixels } from "@/lib/crop";

type Props = {
  inputName: string;
  cropPrefix: string;
  aspect: number;
  label: string;
  initialUrl?: string | null;
  /** Hidden field name for remove flag (e.g. remove_cover). Omit for avatar. */
  removeFieldName?: string;
  variant?: "avatar" | "cover";
  emptyHint?: string;
};

function CropModal({
  title,
  imageSrc,
  aspect,
  crop,
  zoom,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onConfirm,
  onCancel,
  confirmDisabled,
  confirming,
}: {
  title: string;
  imageSrc: string;
  aspect: number;
  crop: { x: number; y: number };
  zoom: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (_area: Area, pixels: Area) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled: boolean;
  confirming: boolean;
}) {
  const cropAreaClass =
    aspect === 1 ? "aspect-square max-h-[min(60vh,420px)]" : "aspect-video max-h-[min(50vh,360px)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2
            id="crop-modal-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none px-1"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div
            className={`relative w-full overflow-hidden rounded-none border border-[#D4AF37]/50 bg-zinc-900 ${cropAreaClass}`}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider shrink-0">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => onZoomChange(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 accent-[#D4AF37] rounded-lg appearance-none cursor-pointer outline-none"
            />
          </div>

          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 opacity-60">
            ลากและซูมเพื่อ crop — รูปจะถูกบันทึกตามที่เห็น
          </p>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={confirmDisabled || confirming}
            >
              {confirming ? "กำลังประมวลผล…" : "ใช้รูปนี้"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageCropField({
  inputName,
  cropPrefix,
  aspect,
  label,
  initialUrl = null,
  removeFieldName,
  variant = "cover",
  emptyHint,
}: Props) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isNewFile, setIsNewFile] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [confirmingCrop, setConfirmingCrop] = useState(false);

  function revokePreviewBlob() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      revokePreviewBlob();
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!cropModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cropModalOpen]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  function resetPendingFile() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    revokePreviewBlob();
    setObjectUrl(null);
    setCropSrc(null);
    setIsNewFile(false);
    setCroppedArea(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    revokePreviewBlob();
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCropSrc(url);
    setIsNewFile(true);
    setRemoved(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setPreviewUrl(null);
    setCropModalOpen(true);
  }

  async function handleCropConfirm() {
    if (!croppedArea || !cropSrc) return;

    setConfirmingCrop(true);
    try {
      const croppedPreview = await createCroppedPreviewUrl(
        cropSrc,
        croppedArea as CropPixels,
      );
      revokePreviewBlob();
      previewBlobRef.current = croppedPreview;
      setPreviewUrl(croppedPreview);
      setCropModalOpen(false);
    } finally {
      setConfirmingCrop(false);
    }
  }

  function handleCropCancel() {
    resetPendingFile();
    setPreviewUrl(removed ? null : initialUrl);
    setCropModalOpen(false);
  }

  function handleRemove() {
    resetPendingFile();
    setPreviewUrl(null);
    setRemoved(true);
    setCropModalOpen(false);
  }

  function openCropOrPicker() {
    if (cropSrc && isNewFile) {
      setCropModalOpen(true);
      return;
    }
    fileInputRef.current?.click();
  }

  const showSavedPreview = previewUrl && !cropModalOpen;
  const previewSize =
    variant === "avatar" ? "h-36 w-36 mx-auto" : "h-32 w-full";
  const emptySize =
    variant === "avatar" ? "h-36 w-36 mx-auto" : "h-28 w-full";
  const cropModalTitle =
    variant === "avatar" ? "ปรับรูปโปรไฟล์" : "ปรับภาพปก";

  return (
    <div className="space-y-1.5 pb-2 w-full min-w-0">
      <Label htmlFor={inputId}>{label}</Label>

      <input
        ref={fileInputRef}
        id={inputId}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
      />

      {removeFieldName && (
        <input
          type="hidden"
          name={removeFieldName}
          value={removed ? "true" : "false"}
        />
      )}

      {isNewFile && croppedArea && (
        <>
          <input type="hidden" name={`${cropPrefix}_x`} value={Math.round(croppedArea.x)} />
          <input type="hidden" name={`${cropPrefix}_y`} value={Math.round(croppedArea.y)} />
          <input
            type="hidden"
            name={`${cropPrefix}_width`}
            value={Math.round(croppedArea.width)}
          />
          <input
            type="hidden"
            name={`${cropPrefix}_height`}
            value={Math.round(croppedArea.height)}
          />
        </>
      )}

      {cropModalOpen && cropSrc && (
        <CropModal
          title={cropModalTitle}
          imageSrc={cropSrc}
          aspect={aspect}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          confirmDisabled={!croppedArea}
          confirming={confirmingCrop}
        />
      )}

      {showSavedPreview ? (
        <div
          className={`group relative overflow-hidden rounded-none border border-zinc-200 dark:border-zinc-800 shadow-inner ${previewSize}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/0 transition-colors duration-200 group-hover:bg-black/45 group-focus-within:bg-black/45 group-active:bg-black/45 [@media(hover:none)]:bg-black/30">
            <button
              type="button"
              onClick={openCropOrPicker}
              aria-label="เปลี่ยนรูป"
              className="rounded-full p-2.5 text-white opacity-0 transition-all duration-200 hover:bg-white/20 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] [@media(hover:none)]:opacity-100"
            >
              <PencilSquareIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="ลบรูป"
              className="rounded-full p-2.5 text-white opacity-0 transition-all duration-200 hover:bg-white/20 hover:text-rose-300 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 [@media(hover:none)]:opacity-100"
            >
              <TrashIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ) : cropModalOpen ? (
        <div
          className={`flex items-center justify-center border border-dashed border-[#D4AF37]/40 bg-zinc-50 dark:bg-zinc-900/40 text-[10px] font-mono uppercase tracking-wider text-zinc-400 ${emptySize}`}
        >
          กำลัง crop…
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={
            variant === "avatar" ? "เพิ่มรูปโปรไฟล์" : "เพิ่มรูปปก"
          }
          className={`block border border-dashed border-zinc-300 hover:border-[#D4AF37]/70 dark:border-zinc-700 dark:hover:border-[#D4AF37]/70 bg-zinc-50 hover:bg-zinc-100/80 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60 rounded-none cursor-pointer transition-colors duration-200 ${emptySize}`}
        >
          {emptyHint && <span className="sr-only">{emptyHint}</span>}
        </button>
      )}
    </div>
  );
}

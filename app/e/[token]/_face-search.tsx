"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { CameraIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { searchFaces, type SearchResult } from "@/lib/actions/face-search";

type Props = {
  eventId: string;
  shareToken: string;
};

type Step = "consent" | "upload" | "searching" | "results" | "empty" | "error";
type Photo = { id: string; webUrl: string; fullUrl: string; faceCount: number };

export function FaceSearch({ eventId, shareToken }: Props) {
  const [step, setStep] = useState<Step>("consent");
  const [consentChecked, setConsentChecked] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const galleryRef = useRef<HTMLInputElement>(null);

  const applySelectedFile = (file: File) => {
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setStep("upload");
    setSourcePickerOpen(false);
    setCameraOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applySelectedFile(file);
    e.target.value = "";
  };

  const openSourcePicker = () => setSourcePickerOpen(true);

  const clearInputs = () => {
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const handleSearch = () => {
    if (!selectedFile) return;

    setStep("searching");

    startTransition(async () => {
      const compressed = await compressImage(selectedFile, 1200, 0.85);

      const fd = new FormData();
      fd.append("share_token", shareToken);
      fd.append("event_id", eventId);
      fd.append("selfie", compressed, "selfie.jpg");

      const res = await searchFaces(fd);
      setResult(res);
      if (res.ok) {
        setStep(res.photos.length > 0 ? "results" : "empty");
      } else {
        setStep("error");
      }
    });
  };

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setSelectedFile(null);
    setResult(null);
    setLightboxIndex(null);
    clearInputs();
  };

  // ─── Consent gate ──────────────────────────────────────────────────────────
  if (step === "consent") {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            ก่อนค้นหารูปของคุณ
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            ระบบจะส่งรูป selfie ของคุณไปยัง AWS Rekognition เพื่อค้นหาใบหน้า
            รูป selfie จะถูกเก็บชั่วคราวและลบหลัง session หมดอายุ
            ไม่มีการเก็บข้อมูล biometric เพื่อ marketing
          </p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 accent-zinc-900 dark:accent-zinc-100"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            ฉันยอมรับการประมวลผลรูปภาพใบหน้าเพื่อค้นหารูปของฉันในงานนี้
          </span>
        </label>
        <Button
          type="button"
          className="w-full"
          disabled={!consentChecked}
          onClick={() => setStep("upload")}
        >
          ยืนยัน — ไปค้นหารูปของฉัน
        </Button>
      </div>
    );
  }

  // ─── Searching ─────────────────────────────────────────────────────────────
  if (step === "searching") {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4">
        {preview && (
          <div className="mx-auto w-20 h-20 rounded-full overflow-hidden ring-2 ring-zinc-200 dark:ring-zinc-700">
            <Image
              src={preview}
              alt="selfie"
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            กำลังค้นหา...
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ใช้เวลาประมาณ 2–5 วินาที
          </p>
        </div>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Results ───────────────────────────────────────────────────────────────
  if (step === "results" && result?.ok) {
    const photos = result.photos;
    // Promote a solo photo (faceCount === 1) to a 2×2 "big" tile, but at most one
    // big per 6 tiles (gap 5) so the page stays compact and bigs spread out.
    let sinceBig = 99;
    const bigFlags = photos.map((p) => {
      const big = p.faceCount === 1 && sinceBig >= 5;
      sinceBig = big ? 0 : sinceBig + 1;
      return big;
    });
    const allIds = photos.map((p) => p.id).join(",");
    const downloadHref = `/api/download/zip?ids=${allIds}&token=${shareToken}`;

    return (
      <>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              พบรูปของคุณ {photos.length} รูป
            </p>
            <div className="flex items-center gap-3">
              <a
                href={downloadHref}
                download="photos.zip"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                ดาวน์โหลดทั้งหมด
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
              >
                ค้นหาใหม่
              </button>
            </div>
          </div>

          {/* Grid — solo photos (1 face) feature as 2×2, dense-packed */}
          <div className="grid grid-flow-row-dense grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo, i) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={i}
                big={bigFlags[i]}
                onOpen={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            shareToken={shareToken}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((idx) => Math.max(0, (idx ?? 0) - 1))}
            onNext={() =>
              setLightboxIndex((idx) =>
                Math.min(photos.length - 1, (idx ?? 0) + 1),
              )
            }
          />
        )}
      </>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (step === "empty") {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4">
        <div className="text-4xl">📷</div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            ไม่พบรูปของคุณในงานนี้
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            อาจเกิดจากแสงน้อย มุมกล้อง หรือรูปยังไม่ถูก sync
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (step === "error" && result && !result.ok) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-6 text-center space-y-4">
        <div className="text-3xl">⚠️</div>
        <p className="text-sm text-rose-700 dark:text-rose-400">
          {result.message}
        </p>
        {result.reason !== "token_expired" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
          >
            ลองอีกครั้ง
          </Button>
        )}
      </div>
    );
  }

  // ─── Upload / capture selfie ───────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            อัพโหลด selfie เพื่อค้นหารูปของคุณ
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ใช้รูปที่เห็นหน้าชัด — หลีกเลี่ยงแว่นกันแดด หมวก หรือหน้ากาก
          </p>
        </div>

        {/* Preview */}
        {preview ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-2 ring-zinc-200 dark:ring-zinc-700">
              <Image
                src={preview}
                alt="selfie preview"
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
                clearInputs();
                setStep("upload");
                openSourcePicker();
              }}
              className="text-xs text-zinc-500 dark:text-zinc-400 underline underline-offset-2"
            >
              เปลี่ยนรูป
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openSourcePicker}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-10 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
          >
            <span className="text-3xl">🤳</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
              แตะเพื่อถ่ายหรือเลือกรูปจากคลัง
            </span>
          </button>
        )}

        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />

        {sourcePickerOpen && (
          <SelfieSourcePicker
            onCamera={() => {
              setSourcePickerOpen(false);
              setCameraOpen(true);
            }}
            onGallery={() => {
              setSourcePickerOpen(false);
              requestAnimationFrame(() => galleryRef.current?.click());
            }}
            onClose={() => setSourcePickerOpen(false)}
          />
        )}

        {cameraOpen && (
          <CameraCaptureModal
            onCapture={applySelectedFile}
            onClose={() => setCameraOpen(false)}
            onUseGallery={() => {
              setCameraOpen(false);
              requestAnimationFrame(() => galleryRef.current?.click());
            }}
          />
        )}

        <Button
          type="button"
          className="w-full"
          disabled={!preview || pending}
          onClick={handleSearch}
        >
          {pending ? "กำลังค้นหา..." : "ค้นหารูปของฉัน"}
        </Button>
      </div>
    </div>
  );
}

function CameraCaptureModal({
  onCapture,
  onClose,
  onUseGallery,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUseGallery: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("เบราว์เซอร์นี้ไม่รองรับกล้อง — กรุณาเลือกรูปจากคลัง");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "user" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch {
        setError("ไม่สามารถเปิดกล้องได้ — กรุณาอนุญาตการใช้กล้อง หรือเลือกรูปจากคลัง");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  function handleUseGallery() {
    stopCamera();
    onUseGallery();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-capture-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2
            id="camera-capture-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            ถ่าย selfie
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none px-1"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error ? (
            <div className="space-y-4 text-center py-6">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" onClick={handleUseGallery}>
                  เลือกจากคลัง
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative aspect-[3/4] max-h-[55vh] w-full overflow-hidden rounded-lg bg-zinc-900">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover scale-x-[-1] ${ready ? "opacity-100" : "opacity-0"}`}
                />
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                    กำลังเปิดกล้อง…
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                จัดใบหน้าให้อยู่กลางกรอบ แล้วกดถ่าย
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleClose}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={!ready}
                  onClick={handleCapture}
                >
                  ถ่ายรูป
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SelfieSourcePicker({
  onCamera,
  onGallery,
  onClose,
}: {
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="selfie-source-title"
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2
            id="selfie-source-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            เลือกวิธีเพิ่มรูป selfie
          </h2>
        </div>
        <div className="p-3 space-y-1">
          <button
            type="button"
            onClick={onCamera}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <CameraIcon className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={1.5} />
            <span>
              <span className="block font-medium">ถ่ายรูป</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                เปิดกล้องหน้า
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onGallery}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <PhotoIcon className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={1.5} />
            <span>
              <span className="block font-medium">เลือกจากคลัง</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                รูปที่ถ่ายไว้แล้วในเครื่อง
              </span>
            </span>
          </button>
        </div>
        <div className="px-3 pb-3">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Client-side image compression ───────────────────────────────────────────

async function compressImage(
  file: File,
  maxPx: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ─── Photo card ──────────────────────────────────────────────────────────────

type PhotoCardProps = {
  photo: Photo;
  index: number;
  big?: boolean;
  onOpen: () => void;
};

function PhotoCard({ photo, index, big = false, onOpen }: PhotoCardProps) {
  // Staggered reveal — cap the delay so large galleries don't make the last items
  // lag in (skill rule: avoid "excessive motion"). ease-out + reduced-motion: globals.css.
  const revealStyle = { animationDelay: `${Math.min(index, 10) * 40}ms` };
  // Solo photos (faceCount === 1) feature as a 2×2 tile (gap-capped in the results grid).
  const spanClass = big ? "col-span-2 row-span-2" : "";

  if (!photo.webUrl) {
    return (
      <div
        className={`photo-reveal aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center ${spanClass}`}
        style={revealStyle}
      >
        <span className="text-2xl">🖼️</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      style={revealStyle}
      className={`photo-reveal group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${spanClass}`}
    >
      <Image
        src={photo.webUrl}
        alt="event photo"
        fill
        className="object-cover group-hover:opacity-90 transition-opacity"
        sizes={big ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 50vw, 33vw"}
      />
      {/* Hover hint */}
      <div className="absolute inset-0 flex items-end p-2 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-xs text-white font-medium px-1.5 py-0.5 bg-black/40 rounded">
          ดูรูป
        </span>
      </div>
    </button>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

type LightboxProps = {
  photos: Photo[];
  index: number;
  shareToken: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function Lightbox({
  photos,
  index,
  shareToken,
  onClose,
  onPrev,
  onNext,
}: LightboxProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="w-full flex items-center justify-between mb-3 px-1">
          <span className="text-xs text-white/60">
            {index + 1} / {photos.length}
          </span>
          <div className="flex items-center gap-3">
            <a
              href={`/api/download/photo?id=${photo.id}&token=${shareToken}`}
              download={`photo-${index + 1}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              ดาวน์โหลดรูปนี้
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900">
          <Image
            src={photo.webUrl || photo.fullUrl}
            alt="event photo"
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>

        {/* Prev / Next */}
        <div className="flex items-center justify-between w-full mt-3 px-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← ก่อนหน้า
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ถัดไป →
          </button>
        </div>
      </div>
    </div>
  );
}

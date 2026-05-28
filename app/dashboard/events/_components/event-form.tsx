"use client";

import { useActionState, useId, useState } from "react";
import { CameraIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import type { EventActionState } from "@/lib/actions/events";
import { TIER_CONFIG, EVENT_TIERS, type EventTier } from "@/lib/credit-packages";

type FormAction = (
  prev: EventActionState,
  formData: FormData,
) => Promise<EventActionState>;

export type FolderInput = {
  label: string;
  folder: string;
};

type EventFormProps = {
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  showTierSelector?: boolean;
  defaults?: {
    name?: string | null;
    event_date?: string | null;
    folders?: FolderInput[];
    tier?: EventTier;
  };
  cancelHref: string;
};

export function EventForm({
  action,
  submitLabel,
  pendingLabel,
  showTierSelector = false,
  defaults,
  cancelHref,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [selectedTier, setSelectedTier] = useState<EventTier>(
    defaults?.tier ?? "starter",
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1); // Zoom scale 1x to 3x
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 }); // X, Y positioning in %
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [startY, setStartY] = useState<number>(0);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isRepositioning, setIsRepositioning] = useState<boolean>(false);
  const formId = useId();

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
      setZoom(1); // Reset zoom
      setPosition({ x: 50, y: 50 }); // Reset position
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRepositioning) return;
    e.preventDefault(); // Prevent standard browser text selection/dragging
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setStartPos({ x: position.x, y: position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !isRepositioning) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    // Map vertical and horizontal pixel shifts to percentage changes
    // Assuming container width is ~500px, height is ~128px
    const pctChangeX = -(deltaX / 500) * 100 / zoom;
    const pctChangeY = -(deltaY / 128) * 100 / zoom;
    
    const newX = Math.max(0, Math.min(100, startPos.x + pctChangeX));
    const newY = Math.max(0, Math.min(100, startPos.y + pctChangeY));
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch Support
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isRepositioning) return;
    if (e.cancelable) e.preventDefault(); // Prevent page scrolling while dragging image
    const touch = e.touches[0];
    setIsDragging(true);
    setStartX(touch.clientX);
    setStartY(touch.clientY);
    setStartPos({ x: position.x, y: position.y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !isRepositioning) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    
    const pctChangeX = -(deltaX / 500) * 100 / zoom;
    const pctChangeY = -(deltaY / 128) * 100 / zoom;
    
    const newX = Math.max(0, Math.min(100, startPos.x + pctChangeX));
    const newY = Math.max(0, Math.min(100, startPos.y + pctChangeY));
    
    setPosition({ x: newX, y: newY });
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Event Cover Image Upload Widget */}
      <div className="space-y-1.5 pb-2">
        <Label>ภาพปก Event</Label>
        <input
          id="cover-photo-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />
        {coverPreview ? (
          <div className="space-y-1.5">
            <div
              className={`relative h-32 w-full overflow-hidden rounded-[2px] border border-zinc-200 dark:border-zinc-800 shadow-inner select-none ${
                isRepositioning ? "cursor-move ring-1 ring-[#D4AF37]" : "group/cover"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <img
                src={coverPreview}
                alt="Event Cover Preview"
                className="w-full h-full object-cover select-none pointer-events-none"
                style={{ 
                  transform: `scale(${zoom})`,
                  objectPosition: `${position.x}% ${position.y}%`,
                  transformOrigin: "center"
                }}
                draggable="false"
              />
              {isRepositioning && (
                <div className="absolute top-2.5 left-2.5 bg-black/75 border border-[#D4AF37]/50 text-white text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 select-none pointer-events-none rounded-[1px]">
                  ✛ Drag in any direction to Pan / Crop
                </div>
              )}
              {!isRepositioning && (
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
                  {/* Reposition/Edit Icon */}
                  <button
                    type="button"
                    onClick={() => setIsRepositioning(true)}
                    className="h-9 w-9 rounded-full bg-black/60 border border-white/20 hover:border-[#D4AF37] hover:text-[#D4AF37] text-white flex items-center justify-center transition-all duration-300 shadow-sm cursor-pointer"
                    title="Reposition Cover (Edit)"
                  >
                    <PencilSquareIcon className="h-5 w-5 stroke-[1.5]" />
                  </button>

                  {/* Remove Icon */}
                  <button
                    type="button"
                    onClick={() => {
                      setCoverPreview(null);
                      setZoom(1);
                      setPosition({ x: 50, y: 50 });
                    }}
                    className="h-9 w-9 rounded-full bg-black/60 border border-white/20 hover:border-rose-500 hover:text-rose-400 text-white flex items-center justify-center transition-all duration-300 shadow-sm cursor-pointer"
                    title="Remove Cover"
                  >
                    <TrashIcon className="h-5 w-5 stroke-[1.5]" />
                  </button>
                </div>
              )}
            </div>
            {isRepositioning && (
              <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-950 p-2.5 border border-zinc-200 dark:border-zinc-800/80 rounded-[2px] animate-fade-in duration-300">
                <div className="flex items-center gap-3 px-1 py-0.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider">
                    Zoom:
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 accent-[#D4AF37] rounded-lg appearance-none cursor-pointer outline-none"
                  />
                  <span className="text-[10px] font-mono text-[#D4AF37] min-w-[32px] text-right font-bold">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans pl-1">
                    ลากรูปปรับทิศทางอิสระ และเลื่อนแถบ Zoom เพื่อขยายรูปภาพ
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRepositioning(false)}
                    className="bg-[#D4AF37]/15 border border-[#D4AF37]/50 hover:bg-[#D4AF37]/35 text-[#D4AF37] font-mono text-[10px] tracking-wider uppercase px-3 py-1 transition-all rounded-[2px] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor="cover-photo-input"
            className="flex flex-col items-center justify-center h-28 border border-dashed border-[#D4AF37]/35 dark:border-[#D4AF37]/20 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] bg-white dark:bg-zinc-900/30 hover:bg-[#FBF9F6] dark:hover:bg-[#111111]/40 rounded-[2px] cursor-pointer transition-all duration-300 p-4 space-y-1 text-center group/dropzone shadow-sm"
          >
            <CameraIcon className="h-6 w-6 text-[#D4AF37]/75 group-hover/dropzone:scale-105 transition-transform duration-300 stroke-[1.5]" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 font-mono tracking-widest uppercase pt-0.5">
              Add Cover Image
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans tracking-tight">
              อัปโหลดรูปภาพแนะนำหรือภาพหน้าปกงาน (ขนาดแนะนำ 16:9)
            </span>
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-name`}>ชื่อ Event</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaults?.name ?? ""}
          placeholder="งานแต่งคุณเอ — 1 มี.ค. 2026"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-date`}>วันจัดงาน</Label>
        <Input
          id={`${formId}-date`}
          name="event_date"
          type="date"
          defaultValue={defaults?.event_date ?? ""}
        />
      </div>

      {showTierSelector && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none mb-1">
            Event Tier
          </legend>
          <input type="hidden" name="tier" value={selectedTier} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {EVENT_TIERS.map((tier) => {
              const cfg = TIER_CONFIG[tier];
              const isSelected = selectedTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTier(tier)}
                  className={[
                    "flex flex-col gap-1 rounded-none border p-4 text-left transition-all duration-300 cursor-pointer",
                    isSelected
                      ? "border-[#D4AF37] bg-[#F5EEDC] text-[#111111] dark:bg-[#27272A] dark:text-[#FBF9F6]"
                      : "border-zinc-200/80 bg-transparent text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs tracking-wider uppercase font-semibold">{cfg.label}</span>
                    <span className="text-sm font-mono tracking-wider font-bold text-[#D4AF37]">{cfg.creditCost} cr</span>
                  </div>
                  <span
                    className={[
                      "text-[11px] leading-relaxed mt-1 opacity-70",
                    ].join(" ")}
                  >
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}


      {state?.error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

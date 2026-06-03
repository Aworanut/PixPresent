"use client";

import { useActionState, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageCropField } from "@/components/image-crop-field";
import type { EventActionState } from "@/lib/actions/events";
import { type EventTier } from "@/lib/credit-packages";
import type { EventTierOption } from "@/lib/pricing";

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
  tiers?: EventTierOption[];
  defaults?: {
    name?: string | null;
    event_date?: string | null;
    folders?: FolderInput[];
    tier?: EventTier;
    cover_image_url?: string | null;
  };
  cancelHref: string;
};

export function EventForm({
  action,
  submitLabel,
  pendingLabel,
  showTierSelector = false,
  tiers = [],
  defaults,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [selectedTier, setSelectedTier] = useState<EventTier>(
    defaults?.tier ?? tiers[0]?.id ?? "starter",
  );
  const formId = useId();

  return (
    <form action={formAction} className="space-y-6">
      <ImageCropField
        inputName="cover_photo"
        cropPrefix="cover_crop"
        aspect={16 / 9}
        label="ภาพปก Event"
        initialUrl={defaults?.cover_image_url}
        removeFieldName="remove_cover"
        variant="cover"
        emptyHint="อัปโหลดรูปภาพแนะนำหรือภาพหน้าปกงาน (16:9)"
      />

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
            {tiers.map((cfg) => {
              const tier = cfg.id;
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
                    <span className="text-xs tracking-wider uppercase font-semibold">
                      {cfg.label}
                    </span>
                    <span className="text-sm font-mono tracking-wider font-bold text-[#D4AF37]">
                      {cfg.creditCost} cr
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed mt-1 opacity-70">
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

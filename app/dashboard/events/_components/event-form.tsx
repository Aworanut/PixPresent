"use client";

import { useActionState, useId, useState } from "react";
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
  const [folders, setFolders] = useState<FolderInput[]>(
    defaults?.folders && defaults.folders.length > 0
      ? defaults.folders
      : [{ label: "", folder: "" }],
  );
  const [selectedTier, setSelectedTier] = useState<EventTier>(
    defaults?.tier ?? "starter",
  );
  const formId = useId();

  const updateRow = (idx: number, key: keyof FolderInput, val: string) => {
    setFolders((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [key]: val } : row)),
    );
  };

  const removeRow = (idx: number) => {
    setFolders((rows) => {
      const next = rows.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ label: "", folder: "" }] : next;
    });
  };

  const addRow = () => {
    setFolders((rows) => [...rows, { label: "", folder: "" }]);
  };

  return (
    <form action={formAction} className="space-y-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{cfg.label}</span>
                    <span className="text-sm font-bold">{cfg.creditCost} cr</span>
                  </div>
                  <span
                    className={[
                      "text-xs leading-snug",
                      isSelected
                        ? "text-zinc-300 dark:text-zinc-600"
                        : "text-zinc-500 dark:text-zinc-400",
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none mb-1">
          Google Drive folders
        </legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ใส่ลิงก์หรือ ID ของ folder ที่ช่างภาพอัพรูปเข้ามา — เพิ่มได้หลายอัน
        </p>

        <ul className="space-y-2">
          {folders.map((row, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                <Input
                  name="folder_labels[]"
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(idx, "label", e.target.value)}
                  placeholder="Label (เช่น ทีมหลัก)"
                  maxLength={60}
                  aria-label={`Folder ${idx + 1} label`}
                />
                <Input
                  name="folder_ids[]"
                  type="text"
                  value={row.folder}
                  onChange={(e) => updateRow(idx, "folder", e.target.value)}
                  placeholder="URL หรือ Folder ID"
                  aria-label={`Folder ${idx + 1} URL or ID`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`ลบ folder ${idx + 1}`}
                onClick={() => removeRow(idx)}
                disabled={folders.length === 1 && !row.folder && !row.label}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + เพิ่ม folder
        </Button>
      </fieldset>

      {state?.error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          aria-disabled={pending}
          className={buttonVariants({ variant: "ghost" })}
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

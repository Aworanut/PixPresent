"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import type { EventActionState } from "@/lib/actions/events";

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
  defaults?: {
    name?: string | null;
    event_date?: string | null;
    folders?: FolderInput[];
  };
  cancelHref: string;
};

export function EventForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  cancelHref,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [folders, setFolders] = useState<FolderInput[]>(
    defaults?.folders && defaults.folders.length > 0
      ? defaults.folders
      : [{ label: "", folder: "" }],
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

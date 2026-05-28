"use client";

import { useTransition } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { softDeleteEvent } from "@/lib/actions/events";

export function DeleteEventButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `ลบ event "${name}"? (soft-delete + ลบ Rekognition collection — ไม่สามารถ undo ได้)`,
          )
        ) {
          return;
        }
        startTransition(async () => {
          await softDeleteEvent(id);
        });
      }}
      className="cta-button h-8 px-2.5 sm:px-3 text-[10px] sm:text-xs rounded-[2px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/5 dark:hover:bg-rose-950/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all duration-300 font-mono leading-none"
    >
      <TrashIcon className="h-4 w-4 stroke-[1.5] flex-shrink-0 relative top-[-0.5px]" />
      <span className="hidden sm:inline relative top-[0.5px]">{pending ? "Deleting..." : "Delete"}</span>
    </button>
  );
}

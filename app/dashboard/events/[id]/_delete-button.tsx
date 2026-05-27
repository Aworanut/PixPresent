"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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
    <Button
      variant="outline"
      size="sm"
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
      className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30"
    >
      {pending ? "กำลังลบ..." : "ลบ"}
    </Button>
  );
}

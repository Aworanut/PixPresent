"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePersonAction } from "@/lib/actions/people";

export function DeletePersonButton({ personId }: { personId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!confirm("ลบบุคคลนี้? การจับคู่รูปทั้งหมดจะถูกยกเลิก (รูปต้นฉบับไม่ถูกลบ)")) return;
    startTransition(async () => {
      await deletePersonAction(personId);
      router.push("/dashboard/people");
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-xs text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50"
    >
      {pending ? "กำลังลบ…" : "ลบบุคคล"}
    </button>
  );
}

import Link from "next/link";
import { createEvent } from "@/lib/actions/events";
import { EventForm } from "../_components/event-form";

export default function NewEventPage() {
  return (
    <div className="max-w-xl space-y-6">
      <nav className="text-sm">
        <Link
          href="/dashboard"
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Dashboard
        </Link>
      </nav>

      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          สร้าง Event ใหม่
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          กรอกข้อมูลพื้นฐาน — เริ่ม Sync &amp; Index ใน step ถัดไป
        </p>
      </header>

      <EventForm
        action={createEvent}
        submitLabel="สร้าง Event"
        pendingLabel="กำลังสร้าง..."
        showTierSelector={true}
        cancelHref="/dashboard"
      />
    </div>
  );
}

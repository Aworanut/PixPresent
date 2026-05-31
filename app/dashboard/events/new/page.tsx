import Link from "next/link";
import { createEvent } from "@/lib/actions/events";
import { loadEventTierList } from "@/lib/pricing";
import { EventForm } from "../_components/event-form";

export default async function NewEventPage() {
  const tiers = await loadEventTierList();

  return (
    <div className="w-full flex items-center justify-center py-4 sm:py-8">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-none shadow-sm p-6 sm:p-8 space-y-6">
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
          tiers={tiers}
          cancelHref="/dashboard"
        />
      </div>
    </div>
  );
}

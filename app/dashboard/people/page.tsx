import Link from "next/link";
import { UserCircleIcon, UsersIcon } from "@heroicons/react/24/outline";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { listPeople, getPendingScanCount } from "@/lib/people/queries";
import { PeopleScanRunner } from "./_scan-runner";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) return null; // proxy.ts redirects unauthenticated users to /login

  if (ctx.tenant.plan !== "business") {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center space-y-3">
        <UsersIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          สารบัญบุคคล (ค้นรูปด้วยใบหน้าข้ามทุกงาน) ใช้ได้กับแพ็กเกจ Business
        </p>
        <Link href="/dashboard/account" className="inline-block text-sm text-[#D4AF37] underline">
          ดูรายละเอียดแผน
        </Link>
      </div>
    );
  }

  const { q } = await searchParams;
  const [people, pendingScanCount] = await Promise.all([listPeople(q), getPendingScanCount()]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">สารบัญบุคคล</h1>
        <form method="GET">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ค้นชื่อ…"
            className="w-52 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </form>
      </div>

      <PeopleScanRunner pendingCount={pendingScanCount} />

      {people.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <UserCircleIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {q
              ? `ไม่พบ "${q}"`
              : "ยังไม่มีบุคคล — ไปที่รูปในงานแล้วกด ⋮ → บันทึกเป็นบุคคล"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/dashboard/people/${person.id}`}
              className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-[#D4AF37] transition-colors"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <UserCircleIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="truncate text-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {person.name}
              </p>
              <p className="mt-0.5 text-center text-xs text-zinc-400">{person.photoCount} รูป</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StatCard } from "../_stat-card";

type FeedbackRow = {
  id: string;
  source: string;
  rating: number | null;
  comment: string | null;
  answers: Record<string, string> | null;
  created_at: string;
  tenants: unknown;
  events: unknown;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Supabase embeds a to-one relation as an object, but be defensive about arrays.
function embeddedName(x: unknown): string | null {
  if (!x) return null;
  if (Array.isArray(x)) return (x[0] as { name?: string })?.name ?? null;
  return (x as { name?: string }).name ?? null;
}

function answersSummary(answers: Record<string, string> | null): string {
  if (!answers) return "";
  return Object.entries(answers)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default async function AdminFeedbackPage() {
  const admin = createServiceRoleClient();

  // `feedback_responses` is not in the generated types until its migration
  // applies (blocked by migration drift on 20260530030000). Untyped view for now.
  const { data } = await (admin as unknown as SupabaseClient)
    .from("feedback_responses")
    .select(
      "id, source, rating, comment, answers, created_at, tenants(name), events(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as FeedbackRow[];
  const guest = rows.filter((r) => r.source === "guest");
  const organizer = rows.filter((r) => r.source === "organizer");
  const ratings = (list: FeedbackRow[]) =>
    list.map((r) => r.rating).filter((n): n is number => n != null);
  const guestAvg = avg(ratings(guest));
  const orgAvg = avg(ratings(organizer));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Feedback
        </h1>
        <p className="mt-1 text-sm text-zinc-500">เสียงจาก organizer และ guest</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="ทั้งหมด"
          value={String(rows.length)}
          hint="ล่าสุด 100 รายการ"
        />
        <StatCard label="จาก Guest" value={String(guest.length)} />
        <StatCard label="จาก Organizer" value={String(organizer.length)} />
        <StatCard
          label="คะแนนเฉลี่ย"
          value={
            guestAvg != null || orgAvg != null
              ? `${(guestAvg ?? orgAvg ?? 0).toFixed(1)}★`
              : "—"
          }
          accent="amber"
          hint={`guest ${guestAvg?.toFixed(1) ?? "—"} · org ${orgAvg?.toFixed(1) ?? "—"}`}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มี feedback</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Source</th>
                <th className="px-4 py-2.5 text-left font-medium">คะแนน</th>
                <th className="px-4 py-2.5 text-left font-medium">รายละเอียด</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                  จาก
                </th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                  เมื่อ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => {
                const who =
                  embeddedName(r.tenants) ?? embeddedName(r.events) ?? "—";
                const summary = answersSummary(r.answers);
                return (
                  <tr key={r.id} className="bg-white dark:bg-zinc-900">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.source === "guest"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400"
                            : "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400"
                        }`}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {r.rating != null ? `${r.rating}★` : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {r.comment && (
                        <p className="text-zinc-800 dark:text-zinc-200">
                          {r.comment}
                        </p>
                      )}
                      {summary && (
                        <p className="mt-0.5 text-xs text-zinc-400">{summary}</p>
                      )}
                      {!r.comment && !summary && (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">
                      {who}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                      {fmt(r.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { StatCard } from "../_stat-card";

// ─── Pricing constants ────────────────────────────────────────────────────────

const R2_GB_MONTH_USD = 0.015;
const REKOG_INDEX_USD = 0.001;
const REKOG_SEARCH_USD = 0.001;
const USD_THB = Number(process.env.USD_TO_THB ?? "35");

const FIXED_THB =
  (Number(process.env.SUPABASE_MONTHLY_COST_USD ?? "0") +
    Number(process.env.RESEND_MONTHLY_COST_USD ?? "0")) *
    USD_THB +
  Number(process.env.SLIPOK_MONTHLY_COST_THB ?? "0") +
  Number(process.env.OTHER_MONTHLY_COST_THB ?? "0");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: monthKey(d),
      label: d.toLocaleString("th-TH", { month: "long", year: "numeric" }),
      start: d,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FinancesPage() {
  const admin = createServiceRoleClient();
  const months = lastSixMonths();
  const sixMonthsAgo = months[0].start.toISOString();

  const [slipsRes, photosRes, sessionsRes] = await Promise.all([
    admin
      .from("slip_uploads")
      .select("amount_thb, verified_at")
      .eq("status", "approved")
      .gte("verified_at", sixMonthsAgo),
    admin.from("photos").select("created_at").gte("created_at", sixMonthsAgo),
    admin
      .from("guest_sessions")
      .select("created_at")
      .gte("created_at", sixMonthsAgo),
  ]);

  // storage_bytes added in migration 20260530010000; regenerate with npm run db:types
  const allPhotosRes = await admin.from("photos").select("storage_bytes");
  const allPhotos = (allPhotosRes.data ?? []) as unknown as {
    storage_bytes: number | null;
  }[];

  const slips = slipsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const totalStorageBytes = allPhotos.reduce(
    (s, p) => s + (p.storage_bytes ?? 0),
    0,
  );
  const totalStorageGB = totalStorageBytes / 1024 ** 3;
  const r2MonthlyUSD = totalStorageGB * R2_GB_MONTH_USD;
  const r2MonthlyTHB = r2MonthlyUSD * USD_THB;

  const rows = months.map((m) => {
    const inMonth = (dateStr: string) => monthKey(new Date(dateStr)) === m.key;

    const revenue = slips
      .filter((s) => s.verified_at && inMonth(s.verified_at))
      .reduce((sum, s) => sum + s.amount_thb, 0);

    const photosIndexed = photos.filter((p) => inMonth(p.created_at)).length;
    const searches = sessions.filter((s) => inMonth(s.created_at)).length;

    const rekognitionTHB =
      (photosIndexed * REKOG_INDEX_USD + searches * REKOG_SEARCH_USD) * USD_THB;
    const totalCost = rekognitionTHB + r2MonthlyTHB + FIXED_THB;
    const net = revenue - totalCost;

    return {
      ...m,
      revenue,
      photosIndexed,
      searches,
      rekognitionTHB,
      r2THB: r2MonthlyTHB,
      totalCost,
      net,
    };
  });

  const current = rows[rows.length - 1];

  const thb = (n: number) =>
    `฿${Math.round(n).toLocaleString("th-TH")}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Finances
      </h1>

      {/* Summary — current month */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="รายได้เดือนนี้"
          value={thb(current.revenue)}
          hint="slip ที่อนุมัติแล้ว"
        />
        <StatCard
          label="ต้นทุนเดือนนี้"
          value={thb(current.totalCost)}
          accent="rose"
          hint="ประมาณการ"
        />
        <StatCard
          label="กำไรสุทธิ"
          value={`${current.net >= 0 ? "+" : ""}${thb(current.net)}`}
          accent={current.net >= 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="R2 Storage"
          value={`${totalStorageGB.toFixed(2)} GB`}
          hint={`≈ $${r2MonthlyUSD.toFixed(2)}/เดือน`}
        />
      </div>

      {/* 6-month P&L table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            P&amp;L รายเดือน
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            ต้นทุน AWS เป็นประมาณการ · $1 = ฿{USD_THB}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {[
                  ["เดือน", "left"],
                  ["รายได้", "right"],
                  ["Rekognition", "right"],
                  ["R2 Storage", "right"],
                  ["Fixed", "right"],
                  ["รวมต้นทุน", "right"],
                  ["กำไร", "right"],
                ].map(([h, align]) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-medium text-zinc-500 text-${align}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {thb(row.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">
                    {thb(row.rekognitionTHB)}
                    <span className="ml-1 text-[10px] text-zinc-400">
                      {row.photosIndexed}+{row.searches}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">
                    {thb(row.r2THB)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">
                    {thb(FIXED_THB)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {thb(row.totalCost)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs font-semibold ${
                      row.net >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {row.net >= 0 ? "+" : ""}
                    {thb(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
          <p className="text-xs text-zinc-400">
            Rekognition: ฿{(REKOG_INDEX_USD * USD_THB * 100).toFixed(0)} สต./รูปที่ index ·
            ฿{(REKOG_SEARCH_USD * USD_THB * 100).toFixed(0)} สต./session · R2:
            $0.015/GB/เดือน
          </p>
        </div>
      </div>

      {/* Fixed costs config note */}
      {FIXED_THB === 0 && (
        <p className="text-xs text-zinc-400">
          ตั้งค่า Fixed costs ผ่าน env vars:{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            SUPABASE_MONTHLY_COST_USD
          </code>
          ,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            SLIPOK_MONTHLY_COST_THB
          </code>
          ,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            RESEND_MONTHLY_COST_USD
          </code>
          ,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            OTHER_MONTHLY_COST_THB
          </code>
        </p>
      )}
    </div>
  );
}

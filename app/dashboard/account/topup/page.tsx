import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { TopupFlow } from "./_topup-flow";

export default async function TopupPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/login");

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/account"
            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-1 inline-block"
          >
            ← Account
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            เติม Credit
          </h1>
        </div>

        {/* Current balance pill */}
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 mt-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {ctx.tenant.credit_balance.toLocaleString()}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">cr</span>
        </div>
      </div>

      <TopupFlow />
    </div>
  );
}

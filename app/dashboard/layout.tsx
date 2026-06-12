import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon, UsersIcon } from "@heroicons/react/24/outline";
import { ScanFace } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, tenantDisplayName } from "@/lib/auth/current-tenant";
import { needsOnboarding } from "@/lib/auth/onboarding";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import { signOut } from "@/lib/actions/auth";
import { FeedbackWidget } from "./_feedback-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentTenant();
  // Proxy should have redirected, but guard anyway in case of race
  if (!ctx) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (await needsOnboarding(user.id)) {
        redirect("/onboarding");
      } else {
        return (
          <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-6 dark:bg-zinc-950">
            <div className="max-w-md space-y-4 rounded-none border border-[#C9A227]/20 bg-[#FDFBF7] p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h1 className="text-lg font-semibold text-[#271A12] dark:text-zinc-100 font-heading">
                เปิดหน้า Dashboard ไม่สำเร็จ
              </h1>
              <p className="text-sm text-[#5C4A3A] dark:text-zinc-400">
                โปรไฟล์ tenant อาจยังไม่พร้อมหรือ migration ยังไม่ครบ กรุณาออกจากระบบแล้ว
                เข้าสู่ระบบใหม่อีกครั้ง
              </p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="cta-button h-8 px-3 text-[10px] font-mono uppercase tracking-widest rounded-[2px] text-[#271A12] dark:text-zinc-300 flex items-center leading-none"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        );
      }
    } else {
      redirect("/login");
    }
  }
  if (await needsOnboarding(ctx.user.id)) redirect("/onboarding");

  const displayName = tenantDisplayName(ctx.tenant);
  const avatarUrl = ctx.tenant.avatar_url ?? ctx.user.avatar_url;
  const isSuperAdmin = isSuperAdminEmail(ctx.user.email);
  const isBusiness = ctx.tenant.plan === "business";

  return (
    <div className="flex flex-1 flex-col bg-[#FDFBF7] dark:bg-zinc-950">
      <header className="border-t-2 border-[#271A12] border-b border-b-[#E8D9BE] dark:border-t-zinc-700 dark:border-b-zinc-800 bg-[#FDFBF7] dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FB923C] to-[#EA580C] text-white shadow-sm">
              <ScanFace className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight text-[#271A12] dark:text-zinc-100">
              PixPresent
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {isBusiness && (
              <Link
                href="/dashboard/people"
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#5C4A3A] dark:text-zinc-400 hover:text-[#A16207] dark:hover:text-[#A16207] transition-colors"
              >
                <UsersIcon className="h-4 w-4" />
                <span className="hidden sm:inline">บุคคล</span>
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#5C4A3A] dark:text-zinc-400 hover:text-[#A16207] dark:hover:text-[#A16207] transition-colors"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <div className="flex items-baseline gap-1 border-x border-[#C9A227]/20 dark:border-zinc-700 px-3 py-0.5">
              <span className="text-sm font-heading font-light text-[#271A12] dark:text-zinc-200 tabular-nums">
                {ctx.tenant.credit_balance.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#5C4A3A] dark:text-zinc-500">cr</span>
            </div>
            <Link
              href="/dashboard/account"
              className="hidden sm:flex items-center gap-2.5 text-sm font-medium text-[#271A12] dark:text-zinc-100 hover:opacity-70 transition-opacity"
            >
              <span>{displayName}</span>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 24px external avatar; next/image not worth per-domain remotePatterns config
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-6 w-6 rounded-none object-cover border border-[#C9A227]/50 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-6 w-6 rounded-none bg-[#FDFBF7] dark:bg-zinc-950 text-[#A16207] border border-[#C9A227]/65 flex items-center justify-center text-[10px] font-bold font-mono select-none shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="cta-button h-8 px-3 text-[10px] font-mono uppercase tracking-widest rounded-[2px] text-[#271A12] dark:text-zinc-300 flex items-center leading-none"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      <FeedbackWidget />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, tenantDisplayName } from "@/lib/auth/current-tenant";
import { needsOnboarding } from "@/lib/auth/onboarding";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
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
          <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
            <div className="max-w-md space-y-4 rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                เปิดหน้า Dashboard ไม่สำเร็จ
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                โปรไฟล์ tenant อาจยังไม่พร้อมหรือ migration ยังไม่ครบ กรุณาออกจากระบบแล้ว
                เข้าสู่ระบบใหม่อีกครั้ง
              </p>
              <form action={signOut}>
                <Button type="submit" size="sm">
                  Sign out
                </Button>
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

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium tracking-wider uppercase text-zinc-900 dark:text-zinc-100"
          >
            PixPresent
          </Link>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-[#D4AF37] dark:hover:text-[#D4AF37] transition-colors"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {ctx.tenant.credit_balance.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">cr</span>
            </div>
            <Link
              href="/dashboard/account"
              className="hidden sm:flex items-center gap-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity"
            >
              <span>{displayName}</span>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-6 w-6 rounded-none object-cover border border-[#D4AF37]/50 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-6 w-6 rounded-none bg-white dark:bg-zinc-950 text-[#D4AF37] border border-[#D4AF37]/65 flex items-center justify-center text-[10px] font-bold font-mono select-none shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="default" size="sm">
                Sign out
              </Button>
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

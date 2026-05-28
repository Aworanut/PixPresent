import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentTenant();
  // Proxy should have redirected, but guard anyway in case of race
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

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
              <span>{ctx.tenant.name}</span>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={ctx.tenant.name}
                  className="h-6 w-6 rounded-none object-cover border border-[#D4AF37]/50 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-6 w-6 rounded-none bg-white dark:bg-zinc-950 text-[#D4AF37] border border-[#D4AF37]/65 flex items-center justify-center text-[10px] font-bold font-mono select-none shadow-sm">
                  {ctx.tenant.name.charAt(0).toUpperCase()}
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
    </div>
  );
}

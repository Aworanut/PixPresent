import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
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
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {ctx.tenant.name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {ctx.user.email}
              </span>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
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

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { ProfileSection } from "./_profile-section";
import { SecuritySection } from "./_security-section";

type Tab = "profile" | "security";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "connections", label: "Connections", href: "/dashboard/account/connections" },
  { id: "credits", label: "Credits", href: "/dashboard/account/credits" },
  { id: "topup", label: "Top-up", href: "/dashboard/account/topup" },
] as const;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab = "profile" } = await searchParams;
  const tab: Tab = rawTab === "security" ? "security" : "profile";

  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/login");


  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Account
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {ctx.user.email}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) =>
          "href" in t ? (
            <Link
              key={t.id}
              href={t.href}
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {t.label}
            </Link>
          ) : (
            <Link
              key={t.id}
              href={`/dashboard/account?tab=${t.id}`}
              className={[
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
              ].join(" ")}
            >
              {t.label}
            </Link>
          ),
        )}
      </div>

      {/* Content */}
      {tab === "profile" && (
        <ProfileSection tenant={ctx.tenant} email={ctx.user.email ?? ""} />
      )}
      {tab === "security" && <SecuritySection />}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";

type HealthStatus = {
  ok: boolean;
  message: string;
};

async function checkSupabase(): Promise<HealthStatus> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();
    if (error && error.status && error.status >= 500) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "Local Supabase reachable" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}

export default async function Home() {
  const supabaseHealth = await checkSupabase();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950 px-4">
      <main className="w-full max-w-2xl py-16 sm:py-24">
        <div className="space-y-2 mb-12">
          <p className="text-sm font-medium tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            PixPresent · FaceFind
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Event photos, found by face.
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-lg pt-2">
            Local development bootstrap — Phase 1, Issue #1. Once everything is
            green, head to the next issue in <code className="font-mono text-sm bg-zinc-200 dark:bg-zinc-800 rounded px-1.5 py-0.5">ISSUES.md</code>.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            System health
          </h2>

          <HealthRow
            label="Supabase (local)"
            ok={supabaseHealth.ok}
            detail={supabaseHealth.message}
          />
          <HealthRow
            label="Next.js"
            ok={true}
            detail="Running"
          />
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Next steps
          </h2>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-2">
              <span className="text-zinc-400">→</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">#2</strong>{" "}
                Sign up for AWS / Cloudflare R2 / Google Drive (HITL)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">→</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">#3</strong>{" "}
                Database schema + RLS migration
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">→</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100">#4</strong>{" "}
                Organizer auth + tenant provisioning
              </span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function HealthRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          ok ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {detail}
        </p>
      </div>
      <span
        className={`text-xs font-medium ${
          ok
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {ok ? "OK" : "DOWN"}
      </span>
    </div>
  );
}

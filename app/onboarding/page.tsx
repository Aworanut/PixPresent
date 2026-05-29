import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  extractOnboardingDefaults,
  getOnboardingSchemaError,
  needsOnboarding,
} from "@/lib/auth/onboarding";
import { OnboardingForm } from "./_onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await needsOnboarding(user.id))) redirect("/dashboard");

  const schemaError = await getOnboardingSchemaError();
  const defaults = extractOnboardingDefaults(user.user_metadata);

  return (
    <>
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-heading">
          Complete your profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 opacity-60">
          กรอกข้อมูลส่วนตัวเพื่อเริ่มจัดการ event
        </p>
      </header>

      {schemaError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{schemaError}</p>
      ) : (
        <OnboardingForm defaults={defaults} />
      )}
    </>
  );
}

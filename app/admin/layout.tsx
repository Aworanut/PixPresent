import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isSuperAdminEmail(user?.email)) redirect("/dashboard");
  return <>{children}</>;
}

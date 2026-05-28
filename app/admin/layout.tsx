import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/payment-config";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");
  return <>{children}</>;
}

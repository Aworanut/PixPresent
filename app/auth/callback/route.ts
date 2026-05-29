import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthRedirect } from "@/lib/auth/onboarding";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Save Drive refresh token when returned (first-time Google OAuth with drive scope)
      if (data.session?.provider_refresh_token) {
        const { createServiceRoleClient } = await import(
          "@/lib/supabase/service-role"
        );
        const admin = createServiceRoleClient();
        await admin
          .from("tenants")
          .update({
            google_refresh_token: data.session.provider_refresh_token,
            google_connected_at: new Date().toISOString(),
          })
          .eq("owner_user_id", data.user.id);
      }

      const destination =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : await getPostAuthRedirect(data.user.id);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}

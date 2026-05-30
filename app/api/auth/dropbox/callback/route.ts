/**
 * GET /auth/dropbox/callback
 * Exchanges the auth code for a refresh token, stores it in
 * tenants.dropbox_refresh_token. Redirects back to state.redirectTo.
 *
 * DROPBOX_REDIRECT_URI must match exactly: http://localhost:3000/auth/dropbox/callback
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeDropboxCode } from "@/lib/dropbox-api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard?error=dropbox_denied`, request.url));
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL(`/dashboard?error=dropbox_invalid`, request.url));
  }

  let redirectTo = "/dashboard";
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
    redirectTo = parsed.redirectTo ?? "/dashboard";
  } catch {
    /* ignore malformed state */
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  let refreshToken: string | undefined;
  try {
    const tokens = await exchangeDropboxCode(code);
    refreshToken = tokens.refresh_token;
  } catch (err) {
    console.error("[dropbox-callback] Token exchange failed:", err);
    return NextResponse.redirect(new URL(`${redirectTo}?error=dropbox_exchange`, request.url));
  }

  if (!refreshToken) {
    return NextResponse.redirect(new URL(`${redirectTo}?error=dropbox_no_refresh_token`, request.url));
  }

  const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
  const admin = createServiceRoleClient();
  const { error: updateErr } = await admin
    .from("tenants")
    .update({
      dropbox_refresh_token: refreshToken,
      dropbox_connected_at: new Date().toISOString(),
    })
    .eq("owner_user_id", user.id);

  if (updateErr) {
    console.error("[dropbox-callback] DB update failed:", updateErr);
    return NextResponse.redirect(new URL(`${redirectTo}?error=dropbox_save_failed`, request.url));
  }

  return NextResponse.redirect(new URL(`${redirectTo}?dropbox=connected`, request.url));
}

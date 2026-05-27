/**
 * GET /auth/google/callback
 *
 * Google OAuth2 callback — exchanges auth code for tokens, stores refresh
 * token in tenants.google_refresh_token. Redirects back to `redirectTo`
 * encoded in the `state` param.
 *
 * GOOGLE_REDIRECT_URI must match exactly: http://localhost:3000/auth/google/callback
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeDriveCode } from "@/lib/google-drive-api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  // User denied access
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_denied`, request.url),
    );
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_invalid`, request.url),
    );
  }

  // Decode state
  let redirectTo = "/dashboard";
  try {
    const parsed = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf-8"),
    );
    redirectTo = parsed.redirectTo ?? "/dashboard";
  } catch {
    // ignore malformed state, fall back to dashboard
  }

  // Must be authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Exchange code for tokens
  let refreshToken: string | null | undefined;
  try {
    const tokens = await exchangeDriveCode(code);
    refreshToken = tokens.refresh_token;
  } catch (err) {
    console.error("[google-callback] Token exchange failed:", err);
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=google_exchange`, request.url),
    );
  }

  if (!refreshToken) {
    // Google only sends refresh_token on first consent. If missing, the user
    // already connected. Ask them to revoke access from Google and retry.
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=google_no_refresh_token`, request.url),
    );
  }

  // Store refresh token in tenant row (service role to bypass RLS)
  const { createServiceRoleClient } = await import(
    "@/lib/supabase/service-role"
  );
  const admin = createServiceRoleClient();

  const { error: updateErr } = await admin
    .from("tenants")
    .update({
      google_refresh_token: refreshToken,
      google_connected_at: new Date().toISOString(),
    })
    .eq("owner_user_id", user.id);

  if (updateErr) {
    console.error("[google-callback] DB update failed:", updateErr);
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=google_save_failed`, request.url),
    );
  }

  return NextResponse.redirect(
    new URL(`${redirectTo}?google=connected`, request.url),
  );
}

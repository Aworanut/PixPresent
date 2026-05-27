/**
 * GET /auth/google
 *
 * Initiates Google OAuth2 consent flow for Drive access.
 * Requires the organizer to be logged in (session checked via Supabase).
 * State param: base64-encoded { redirectTo: string } for post-auth redirect.
 *
 * Needs env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDriveAuthUrl } from "@/lib/google-drive-api";

export async function GET(request: NextRequest) {
  // Must be authenticated as an organizer
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Where to send the organizer after OAuth is complete (default: dashboard)
  const redirectTo =
    request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const state = Buffer.from(
    JSON.stringify({ redirectTo, userId: user.id }),
  ).toString("base64url");

  try {
    const authUrl = getDriveAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch {
    // Google credentials not configured (env vars missing)
    return NextResponse.redirect(
      new URL(
        `/dashboard?error=google_not_configured`,
        request.url,
      ),
    );
  }
}

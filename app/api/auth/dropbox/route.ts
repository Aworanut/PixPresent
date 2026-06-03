/**
 * GET /api/auth/dropbox
 * Initiates Dropbox OAuth2 (offline access). Requires a logged-in organizer.
 * State: base64url { redirectTo, userId }.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDropboxAuthUrl } from "@/lib/dropbox-api";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const redirectTo = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const state = Buffer.from(
    JSON.stringify({ redirectTo, userId: user.id }),
  ).toString("base64url");

  try {
    return NextResponse.redirect(getDropboxAuthUrl(state));
  } catch {
    return NextResponse.redirect(
      new URL(`/dashboard?error=dropbox_not_configured`, request.url),
    );
  }
}

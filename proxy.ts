import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { tenantNeedsOnboarding } from "@/lib/auth/onboarding";

const AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
]);

const ONBOARDING_ROUTE = "/onboarding";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  let onboardingIncomplete = false;

  if (user) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("onboarding_completed_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    onboardingIncomplete = tenantNeedsOnboarding(tenant);
  }

  // Block unauthenticated access to protected areas.
  if (!user && (path.startsWith("/dashboard") || path === ONBOARDING_ROUTE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && onboardingIncomplete) {
    if (
      path.startsWith("/dashboard") ||
      AUTH_ROUTES.has(path) ||
      (path.startsWith("/auth/callback") &&
        request.nextUrl.searchParams.get("next") !== "/reset-password")
    ) {
      return NextResponse.redirect(new URL(ONBOARDING_ROUTE, request.url));
    }
  }

  if (user && !onboardingIncomplete && path === ONBOARDING_ROUTE) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Bounce authenticated users away from auth-only pages.
  if (user && AUTH_ROUTES.has(path) && !onboardingIncomplete) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

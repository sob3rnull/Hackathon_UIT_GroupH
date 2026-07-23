import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  HOME,
  allowedOn,
  isOpenPath,
  isPublicPath,
  isRole,
  isSignedOutOnlyPath,
} from "@/lib/auth/roles";

/**
 * Coarse routing only — NOT the security boundary.
 *
 * Middleware decides which dashboard you land on. It cannot stop a crafted
 * request to /api/*, so the actual enforcement is the RLS policies in
 * migration 0007, plus role checks inside each Route Handler. Treat anything
 * here as UX, not protection.
 */
export async function middleware(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);

  // Memory mode (no Supabase keys): nothing to authenticate against.
  if (!configured) return response;

  const path = request.nextUrl.pathname;

  // The public directory and donation flow are open to everyone, signed in or
  // not. Checked before the session branch so neither redirect can strand it.
  if (isOpenPath(path)) return response;

  if (!user) {
    if (isPublicPath(path)) return response;
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path); // bounce back here after sign-in
    return NextResponse.redirect(url);
  }

  // Role rides in the JWT via profiles -> app_metadata (see 0007), so reading
  // it costs nothing. Absent means the profile is unverified (or not created
  // yet) — such users may sit on /pending or finish/view their /profile, but
  // nothing else.
  const role = user.app_metadata?.role;
  if (!isRole(role)) {
    return path === "/pending" || path === "/profile"
      ? response
      : NextResponse.redirect(new URL("/pending", request.url));
  }

  const home = HOME[role];

  // Signed in but sitting on the login screen — send them home. "/" is not
  // included: it's the public directory and returned early above, so a
  // signed-in user can still browse it. /update-password and /auth/* are
  // excluded too, since recovery signs the user in before they get there.
  if (isSignedOutOnlyPath(path)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (!allowedOn(path, role)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  HOME,
  allowedOn,
  isPublicPath,
  isRole,
  isSignedOutOnlyPath,
} from "@/lib/auth/roles";

/**
 * Coarse routing only — NOT the security boundary.
 *
 * Middleware decides which dashboard you land on. It cannot stop a crafted
 * request to /api/*, so the actual enforcement is the RLS policies in
 * migration 0005, plus role checks inside each Route Handler. Treat anything
 * here as UX, not protection.
 */
export async function middleware(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);

  // Memory mode (no Supabase keys): nothing to authenticate against.
  if (!configured) return response;

  const path = request.nextUrl.pathname;

  if (!user) {
    if (isPublicPath(path)) return response;
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path); // bounce back here after sign-in
    return NextResponse.redirect(url);
  }

  // Role rides in the JWT via profiles -> app_metadata (see 0005), so reading
  // it costs nothing. Absent means no profiles row was created for this user.
  const role = user.app_metadata?.role;
  if (!isRole(role)) {
    return path === "/pending"
      ? response
      : NextResponse.redirect(new URL("/pending", request.url));
  }

  const home = HOME[role];

  // Signed in but sitting on the login screen or the root — send them home.
  // /update-password and /auth/* are excluded: recovery signs the user in
  // before they get there, so bouncing them would strand the reset flow.
  if (path === "/" || isSignedOutOnlyPath(path)) {
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

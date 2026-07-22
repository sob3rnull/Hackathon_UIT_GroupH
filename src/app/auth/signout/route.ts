import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST-only, deliberately.
 *
 * A GET sign-out is CSRF-able: any site could embed <img src="/auth/signout">
 * and log your users out. Requiring POST means it has to come from a real form
 * submission on this origin.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303, // turn the POST into a GET for the redirect
  });
}

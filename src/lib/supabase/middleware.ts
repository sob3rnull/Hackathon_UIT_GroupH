import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie and reports who's signed in.
 *
 * Lives in its own module because Next.js middleware must stay importable from
 * the edge runtime — keep anything `server-only` out of this file's import
 * graph.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // No Supabase configured => memory mode. Let every request through rather
  // than locking the demo out of its own app.
  if (!isSupabaseConfigured) return { response, user: null, configured: false };

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // MUST be getUser(), never getSession(): getSession trusts the cookie without
  // verifying its signature, so a forged cookie would sail straight through.
  // Once you move to asymmetric JWT signing keys, swap this for getClaims(),
  // which verifies locally and drops the per-request network round-trip.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, configured: true };
}

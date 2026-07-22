import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Cookie-aware client for Server Components and Route Handlers.
 * Respects Row Level Security and sees the signed-in user, if you add auth.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore when auth
          // sessions are refreshed by middleware instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely — server code only, and never
 * reachable from anything marked "use client".
 *
 * Optional: the app works fine without it (see `createDataClient`).
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;

  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * What `@/lib/mediroute/store` actually uses.
 *
 * Deliberately the COOKIE-AWARE client, not the service-role one: it carries
 * the signed-in user's JWT, so the RLS policies in migration 0005 are what
 * actually decide who may read and write. Using the admin key here would
 * silently bypass every policy and make them decorative.
 *
 * Returns null only when Supabase isn't configured at all, which is the
 * signal to use the in-memory store.
 *
 * Trusted server jobs that legitimately have no user session (seeding, n8n
 * webhooks) should call `createAdminClient()` explicitly and say why.
 */
export async function createDataClient() {
  return createClient();
}

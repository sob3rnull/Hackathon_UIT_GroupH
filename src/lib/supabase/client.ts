"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Browser-side Supabase client — use for realtime subscriptions, storage
 * uploads, or auth from a client component.
 *
 * Returns null when keys are absent so a component can fall back instead of
 * throwing. Server-side data fetching should go through `@/lib/store`.
 */
export function createClient() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}

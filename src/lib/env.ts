/**
 * Env access in one place. Nothing throws at import time — a missing
 * Supabase key degrades to the in-memory store instead of crashing the
 * app, which is what you want five minutes before a demo.
 */

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Supports both the classic anon key and the newer publishable key name. */
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Server-only. Bypasses RLS — never import this into a client component. */
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  "";

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  supabaseServiceKey: serviceKey,
};

/** True once a URL + anon key are present. Drives the "Demo data" badge. */
export const isSupabaseConfigured = Boolean(url && anonKey);

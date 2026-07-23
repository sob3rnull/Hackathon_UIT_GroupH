import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Resolves a media asset (hero photo, gallery images) to a URL.
 *
 * Prefers Supabase Storage — a public "media" bucket — so images can be
 * swapped from the Supabase dashboard without a redeploy. Falls back to the
 * matching file under `public/` when Supabase isn't configured, same as
 * every other feature's offline/demo path.
 *
 * `path` mirrors the `public/` folder layout — "hero-hospital.jpg",
 * "gallery/gallery-1.jpg" — so upload the same relative paths into the
 * bucket for the two sources to line up. Safe to call from client or
 * server code: both env values it reads are `NEXT_PUBLIC_`.
 */
export function mediaUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (isSupabaseConfigured) {
    return `${env.supabaseUrl}/storage/v1/object/public/media/${clean}`;
  }
  return `/${clean}`;
}

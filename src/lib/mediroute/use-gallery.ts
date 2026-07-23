"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl } from "@/lib/media";

export const GALLERY_PREFIX = "gallery";

/** The 10 photos committed at launch — shown when there's no Storage bucket to list. */
const FALLBACK_COUNT = 10;

export interface GalleryPhoto {
  /** Storage object path (e.g. "gallery/gallery-3.jpg"), or the fallback path locally. */
  path: string;
  url: string;
}

/**
 * The gallery's contents, live. Supabase configured → lists whatever's
 * actually in the bucket's gallery/ folder, so an admin's upload or delete
 * (see media-manager.tsx) shows up on reload without a code change. Not
 * configured → the fixed 10 photos committed under public/gallery/, since
 * there's no bucket to list and nothing here can add to that set at runtime.
 */
export function useGallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setPhotos(
        Array.from({ length: FALLBACK_COUNT }, (_, i) => {
          const path = `${GALLERY_PREFIX}/gallery-${i + 1}.jpg`;
          return { path, url: mediaUrl(path) };
        }),
      );
      setLoading(false);
      return;
    }

    try {
      const { data, error: listError } = await supabase.storage
        .from("media")
        .list(GALLERY_PREFIX, { sortBy: { column: "name", order: "asc" } });
      if (listError) throw listError;

      setPhotos(
        (data ?? [])
          // Storage lists the folder placeholder object too when empty.
          .filter((entry) => entry.name && !entry.name.startsWith("."))
          .map((entry) => {
            const path = `${GALLERY_PREFIX}/${entry.name}`;
            return {
              path,
              url: supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
            };
          }),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load the gallery");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() is async — setState runs after it resolves, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { photos, loading, error, reload: load };
}

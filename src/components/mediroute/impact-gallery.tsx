"use client";

import Image from "next/image";
import { useT } from "@/lib/i18n/context";
import { useGallery } from "@/lib/mediroute/use-gallery";

/**
 * Trust section for the public donation page: photos of Myanmar hospital and
 * ambulance operations, so the ask above doesn't land as an abstract form.
 *
 * Deliberately captioned as illustrative of the wider network rather than
 * claimed as WheeYaw-specific donation records — these photos weren't all
 * taken by this team, and several show identifiable patients and staff, so
 * the honest framing matters as much as the visual.
 *
 * The photo set is live (see use-gallery.ts): when Supabase is configured,
 * an admin adding or removing a photo (src/components/admin/media-manager.tsx)
 * shows up here on reload, no redeploy needed.
 */
export function ImpactGallery() {
  const t = useT();
  const { photos, loading } = useGallery();

  if (!loading && photos.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{t("gallery.title")}</h2>
        <p className="text-sm text-muted">{t("gallery.subtitle")}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-card border border-border bg-surface-muted"
              />
            ))
          : photos.map((photo, index) => (
              <div
                key={photo.path}
                className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface-muted"
              >
                <Image
                  src={photo.url}
                  alt={t("gallery.photoAlt", { count: index + 1 })}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
      </div>

      <p className="mt-4 text-xs text-muted">{t("gallery.disclaimer")}</p>
    </section>
  );
}

"use client";

import * as React from "react";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/context";
import { mediaUrl } from "@/lib/media";
import { useGallery, GALLERY_PREFIX } from "@/lib/mediroute/use-gallery";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "media";

/**
 * Admin-only photo management for the public page: replace the hero
 * background and header logo (fixed one-image slots), add or remove impact
 * gallery photos (a real list, see use-gallery.ts).
 *
 * Uploads go straight from the browser to Supabase Storage using the
 * signed-in admin's own session — the "admin manages media" RLS policy
 * (migration 0011) is the entire authorization boundary, there is no server
 * route bypassing it with a service-role key. Rendered only when the caller
 * has already confirmed profile.role === "admin" (see profile/page.tsx);
 * RLS would refuse the writes either way, this just keeps the section out
 * of view for everyone else.
 */
export function MediaManager() {
  const t = useT();
  const toast = useToast();
  const supabase = createClient();
  const { photos, loading: galleryLoading, reload } = useGallery();

  const [heroBusy, setHeroBusy] = React.useState(false);
  const [logoBusy, setLogoBusy] = React.useState(false);
  const [galleryBusy, setGalleryBusy] = React.useState(false);
  const [removingPath, setRemovingPath] = React.useState<string | null>(null);
  /** Cache-busts the fixed-slot previews after a replace — same URL, new bytes. */
  const [cacheBust, setCacheBust] = React.useState(0);

  if (!supabase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.mediaTitle")}</CardTitle>
          <CardDescription>{t("admin.mediaNotConfigured")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function replaceSlot(
    file: File,
    path: string,
    setBusy: (busy: boolean) => void,
  ) {
    setBusy(true);
    try {
      const { error } = await supabase!.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setCacheBust((n) => n + 1);
      toast({ title: t("admin.mediaUpdated") });
    } catch (cause) {
      toast({
        tone: "danger",
        title: t("admin.mediaUploadFailed"),
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function addGalleryPhoto(file: File) {
    setGalleryBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${GALLERY_PREFIX}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await supabase!.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      await reload();
      toast({ title: t("admin.mediaAdded") });
    } catch (cause) {
      toast({
        tone: "danger",
        title: t("admin.mediaUploadFailed"),
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setGalleryBusy(false);
    }
  }

  async function removeGalleryPhoto(path: string) {
    setRemovingPath(path);
    try {
      const { error } = await supabase!.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      await reload();
      toast({ title: t("admin.mediaRemoved") });
    } catch (cause) {
      toast({
        tone: "danger",
        title: t("admin.mediaRemoveFailed"),
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setRemovingPath(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.mediaTitle")}</CardTitle>
        <CardDescription>{t("admin.mediaDescription")}</CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        {/* ── Hero + logo: fixed single-image slots ────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SlotUploader
            label={t("admin.mediaHero")}
            hint={t("admin.mediaHeroHint")}
            previewSrc={`${mediaUrl("hero-hospital.jpg")}?v=${cacheBust}`}
            busy={heroBusy}
            onPick={(file) => void replaceSlot(file, "hero-hospital.jpg", setHeroBusy)}
          />
          <SlotUploader
            label={t("admin.mediaLogo")}
            hint={t("admin.mediaLogoHint")}
            previewSrc={`${mediaUrl("logo.jpg")}?v=${cacheBust}`}
            busy={logoBusy}
            contain
            onPick={(file) => void replaceSlot(file, "logo.jpg", setLogoBusy)}
          />
        </div>

        {/* ── Gallery: a real list, add/remove freely ──────────────────── */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{t("admin.mediaGallery")}</p>
              <p className="text-xs text-muted">{t("admin.mediaGalleryHint")}</p>
            </div>
            <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-muted">
              {galleryBusy ? <Spinner /> : <Upload className="size-3.5" />}
              {t("admin.mediaAddPhoto")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={galleryBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void addGalleryPhoto(file);
                }}
              />
            </label>
          </div>

          {galleryLoading ? (
            <Spinner />
          ) : photos.length === 0 ? (
            <p className="text-xs text-muted">{t("admin.mediaGalleryEmpty")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((photo) => (
                <div
                  key={photo.path}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Storage URLs, not worth the next/image config churn for an admin-only thumbnail */}
                  <img src={photo.url} alt="" className="size-full object-cover" />
                  <button
                    onClick={() => void removeGalleryPhoto(photo.path)}
                    disabled={removingPath === photo.path}
                    aria-label={t("admin.mediaRemovePhoto")}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    {removingPath === photo.path ? (
                      <Spinner className="text-white" />
                    ) : (
                      <Trash2 className="size-4 text-white" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function SlotUploader({
  label,
  hint,
  previewSrc,
  busy,
  contain,
  onPick,
}: {
  label: string;
  hint: string;
  previewSrc: string;
  busy: boolean;
  contain?: boolean;
  onPick: (file: File) => void;
}) {
  const t = useT();
  const [broken, setBroken] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
        {broken ? (
          <ImageOff className="size-6 text-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- cache-busted arbitrary URL, refreshed post-upload
          <img
            src={previewSrc}
            alt=""
            onError={() => setBroken(true)}
            className={contain ? "max-h-full max-w-full object-contain" : "size-full object-cover"}
          />
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner className="text-white" />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted">{hint}</p>
      <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-muted">
        <Upload className="size-3.5" />
        {t("admin.mediaReplace")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            setBroken(false);
            if (file) onPick(file);
          }}
        />
      </label>
    </div>
  );
}

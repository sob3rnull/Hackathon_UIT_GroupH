"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Ambulance,
  ArrowRight,
  Building2,
  ClipboardList,
  HeartHandshake,
  MapPin,
  PhoneCall,
} from "lucide-react";
import { project } from "@/config/project";
import { useT } from "@/lib/i18n/context";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { HospitalDirectory } from "@/components/mediroute/hospital-directory";
import { ImpactGallery } from "@/components/mediroute/impact-gallery";
import { mediaUrl } from "@/lib/media";

/**
 * The public face of WheeYaw: a directory of the hospitals in the network
 * with live status and a (demo) donation flow. The operational screens are
 * linked from the header and the "For responders" row below.
 */

const roleIcons: Record<string, typeof PhoneCall> = {
  "/dispatcher": PhoneCall,
  "/hospital": Building2,
  "/ambulance": Ambulance,
  "/history": ClipboardList,
};

/** project.nav order → the dictionary's nav.* key for that route. */
const NAV_KEYS = ["dispatcher", "hospital", "ambulance", "history"] as const;

export default function HomePage() {
  const t = useT();

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        {/* Yangon General Hospital, clearly visible behind the text. The
            scrim is a flat tint rather than a heavy gradient so the photo
            reads at full strength while the badge/heading/CTAs — most of
            which sit on their own solid backgrounds anyway — stay legible
            in both themes. */}
        <Image
          src={mediaUrl("hero-hospital.jpg")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          // Served straight from Supabase Storage, not Next's optimizer, so a
          // photo swapped in the dashboard shows up without a redeploy — which
          // is the whole reason these live in a bucket (see lib/media.ts).
          unoptimized
        />
        <div className="absolute inset-0 bg-background/55 dark:bg-background/70" />

        <div className="hero-glow relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-14 text-center sm:py-18">
          <Badge tone="accent">{t("home.heroBadge")}</Badge>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight drop-shadow-sm sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="max-w-2xl text-lg text-foreground/80 drop-shadow-sm">
            {t("project.tagline")}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#donate"
              className="group inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            >
              <HeartHandshake className="size-4" />
              {t("home.supportCta")}
            </a>
            <Link
              href="/dispatcher"
              className="group inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              {t("home.openConsole")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <ImpactGallery />

      <HospitalDirectory />

      {/* ── Role entry points ────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{t("home.forResponders")}</h2>
          <p className="text-sm text-muted">{t("home.forRespondersDesc")}</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {project.nav.map((link, index) => {
            const Icon = roleIcons[link.href] ?? MapPin;
            const key = NAV_KEYS[index];
            return (
              <Link key={link.href} href={link.href} className="group">
                <Card className="h-full transition-colors group-hover:border-accent/50">
                  <CardBody className="flex h-full flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="grid size-8 place-items-center rounded-lg bg-surface-muted text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                        <Icon className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                    <CardTitle>{t(`nav.${key}.label`)}</CardTitle>
                    <p className="text-xs font-medium text-muted">{t(`nav.${key}.role`)}</p>
                    <CardDescription>{t(`nav.${key}.blurb`)}</CardDescription>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

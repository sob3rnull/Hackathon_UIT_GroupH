"use client";

import Link from "next/link";
import { project } from "@/config/project";
import { useT } from "@/lib/i18n/context";

export function SiteFooter() {
  const t = useT();

  return (
    <footer className="border-t border-border py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-5 text-sm text-muted">
        <span>
          {project.name} — {t("chrome.builtBy")} {project.team}
        </span>
        <span className="ml-auto flex items-center gap-4">
          {project.secondaryNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
              title={t("nav.fleetOps.blurb")}
            >
              {t("nav.fleetOps.label")}
            </Link>
          ))}
        </span>
      </div>
    </footer>
  );
}

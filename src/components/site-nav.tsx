"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { project } from "@/config/project";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** project.nav order → the dictionary's nav.* key for that route. */
const NAV_KEYS = ["dispatcher", "hospital", "ambulance", "history"] as const;

/**
 * Role switcher. Split out of SiteHeader because the active-link state needs
 * usePathname, and the header itself stays a Server Component so it can read
 * the store mode without shipping it to the browser.
 *
 * Renders twice: a row on desktop, a horizontally scrollable strip on mobile
 * (the ambulance screen is used on a tablet, so the nav has to survive there).
 */
export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {project.nav.map((link, index) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {t(`nav.${NAV_KEYS[index]}.label`)}
          </Link>
        );
      })}
    </nav>
  );
}

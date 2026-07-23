"use client";

import Image from "next/image";
import Link from "next/link";
import { Database, HardDrive, User } from "lucide-react";
import { project } from "@/config/project";
import { useT } from "@/lib/i18n/context";
import { mediaUrl } from "@/lib/media";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

/**
 * `mode` and `signedIn` are computed server-side in `site-header.tsx`
 * (storeMode() and the Supabase session read both need server-only modules)
 * and passed in as props, so this component can stay client-rendered for
 * the language/theme toggles without shipping those modules to the browser.
 */
export function SiteHeaderClient({
  mode,
  signedIn,
}: {
  mode: "supabase" | "memory";
  signedIn: boolean;
}) {
  const t = useT();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="relative size-7 shrink-0 overflow-hidden rounded-md bg-white">
            <Image src={mediaUrl("logo.jpg")} alt="" fill className="object-contain" />
          </span>
          <span className="tracking-tight">{project.name}</span>
        </Link>

        <SiteNav className="hidden md:flex" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Tells you at a glance whether you're on real data. */}
          <Badge
            tone={mode === "supabase" ? "success" : "warning"}
            className="hidden sm:inline-flex"
            title={mode === "supabase" ? t("chrome.supabaseTooltip") : t("chrome.demoDataTooltip")}
          >
            {mode === "supabase" ? (
              <Database className="size-3" />
            ) : (
              <HardDrive className="size-3" />
            )}
            {mode === "supabase" ? t("chrome.supabaseBadge") : t("chrome.demoDataBadge")}
          </Badge>
          <LanguageToggle />
          <ThemeToggle />

          {signedIn ? (
            <>
              <Link
                href="/profile"
                title={t("chrome.yourProfile")}
                className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <User className="size-4" />
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  {t("auth.signOut")}
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
            >
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile / tablet: the same roles, scrollable. */}
      <div className="border-t border-border px-3 py-1.5 md:hidden">
        <SiteNav className="overflow-x-auto" />
      </div>
    </header>
  );
}

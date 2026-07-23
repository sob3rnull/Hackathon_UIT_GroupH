"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { project } from "@/config/project";
import { allowedOn, type Role } from "@/lib/auth/roles";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Role switcher. Split out of SiteHeader because the active-link state needs
 * usePathname, and the header itself stays a Server Component so it can read
 * the store mode without shipping it to the browser.
 *
 * Role-scoped: signed-out visitors (role null) see no route links at all, and
 * a signed-in user sees only the routes their role may open — the same GUARD
 * the middleware enforces (roles.ts). So the nav never advertises a dashboard
 * that would bounce you straight back.
 *
 * Renders twice: a row on desktop, a horizontally scrollable strip on mobile
 * (the ambulance screen is used on a tablet, so the nav has to survive there).
 */
export function SiteNav({ role, className }: { role: Role | null; className?: string }) {
  const pathname = usePathname();
  const t = useT();

  if (!role) return null;
  const links = project.nav.filter((link) => allowedOn(link.href, role));
  if (links.length === 0) return null;

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {links.map((link) => {
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
            {t(`nav.${link.href.slice(1)}.label`)}
          </Link>
        );
      })}
    </nav>
  );
}

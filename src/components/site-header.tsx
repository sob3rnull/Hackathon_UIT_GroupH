import Link from "next/link";
import { Database, HardDrive, User } from "lucide-react";
import { project } from "@/config/project";
import { storeMode } from "@/lib/mediroute/store";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export async function SiteHeader() {
  const mode = storeMode();

  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
            {project.name.slice(0, 1)}
          </span>
          <span className="tracking-tight">{project.name}</span>
        </Link>

        <SiteNav className="hidden md:flex" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Tells you at a glance whether you're on real data. */}
          <Badge
            tone={mode === "supabase" ? "success" : "warning"}
            className="hidden sm:inline-flex"
            title={
              mode === "supabase"
                ? "Reading and writing Supabase"
                : "No Supabase keys — using in-memory demo data"
            }
          >
            {mode === "supabase" ? (
              <Database className="size-3" />
            ) : (
              <HardDrive className="size-3" />
            )}
            {mode === "supabase" ? "Supabase" : "Demo data"}
          </Badge>
          <ThemeToggle />

          {user ? (
            <>
              <Link
                href="/profile"
                title="Your profile"
                className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <User className="size-4" />
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
            >
              Sign in
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

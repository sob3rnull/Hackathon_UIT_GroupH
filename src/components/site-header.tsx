import Link from "next/link";
import { Database, HardDrive } from "lucide-react";
import { project } from "@/config/project";
import { storeMode } from "@/lib/mediroute/store";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const mode = storeMode();

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
        </div>
      </div>

      {/* Mobile / tablet: the same roles, scrollable. */}
      <div className="border-t border-border px-3 py-1.5 md:hidden">
        <SiteNav className="overflow-x-auto" />
      </div>
    </header>
  );
}

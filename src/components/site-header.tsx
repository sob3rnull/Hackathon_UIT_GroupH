import Link from "next/link";
import { Database, HardDrive } from "lucide-react";
import { project } from "@/config/project";
import { storeMode } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const mode = storeMode();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground text-xs font-bold">
            {project.name.slice(0, 1)}
          </span>
          <span className="tracking-tight">{project.name}</span>
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {project.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Tells you at a glance whether you're on real data. */}
          <Badge
            tone={mode === "supabase" ? "success" : "warning"}
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
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Flips `.dark` on <html> and remembers the choice.
 * The matching no-flash script lives in `layout.tsx`.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

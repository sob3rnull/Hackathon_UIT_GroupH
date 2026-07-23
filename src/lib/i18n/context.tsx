"use client";

import * as React from "react";
import en from "./dictionaries/en";
import my from "./dictionaries/my";

export type Locale = "en" | "my";

const dictionaries = { en, my };

const STORAGE_KEY = "locale";

function resolve(dict: object, path: string): unknown {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

/**
 * Wraps the app so any client component can read/set the active language.
 * Persisted the same way as the theme toggle (localStorage, applied on
 * mount) — no cookies, no server round-trip, no locale-segment routing.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useEffect(() => {
    // Reading external state (localStorage) once on mount, not deriving it
    // from props — same pattern as ThemeToggle's DOM-class sync.
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "my") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(saved);
    }
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = React.useContext(LocaleContext);
  // Safe outside a provider (e.g. isolated component tests): defaults to en.
  return context ?? { locale: "en", setLocale: () => {} };
}

/**
 * `t("donate.thankYouTitle", { name: "Aye Aye" })` — dot-path lookup into
 * the active dictionary, with `{{var}}` interpolation. Falls back to the
 * English string, then to the raw key, so a missing translation is visible
 * instead of blank.
 */
export function useT() {
  const { locale } = useLocale();
  return React.useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = resolve(dictionaries[locale], key) ?? resolve(dictionaries.en, key);
      if (typeof value !== "string") return key;
      return interpolate(value, vars);
    },
    [locale],
  );
}

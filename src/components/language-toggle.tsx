"use client";

import { useLocale, useT } from "@/lib/i18n/context";

/** MM/EN switch next to the theme toggle. Persisted like dark mode. */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "my" : "en")}
      aria-label={t("chrome.languageToggle")}
      title={t("chrome.languageToggle")}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {locale === "en" ? "မြန်မာ" : "EN"}
    </button>
  );
}

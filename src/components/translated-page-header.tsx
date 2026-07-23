"use client";

import type * as React from "react";
import { PageHeader } from "@/components/ui/page";
import { useT } from "@/lib/i18n/context";

/**
 * `PageHeader` translated by dictionary key instead of a literal string.
 *
 * Route pages (`src/app/*\/page.tsx`) stay server components — they export
 * `metadata`, which Next.js only allows outside `"use client"` files — so
 * they can't call `useT()` directly. This is the one client piece each of
 * them renders instead of a plain `<PageHeader title="..." />`. The browser
 * tab title (`metadata.title`) stays English: it's fixed at request time on
 * the server, before the client-side locale toggle has run.
 */
export function TranslatedPageHeader({
  titleKey,
  descriptionKey,
  description,
  eyebrowKey,
  actions,
}: {
  titleKey: string;
  descriptionKey?: string;
  /** Escape hatch for descriptions with embedded markup (e.g. a `<code>` path). */
  description?: React.ReactNode;
  eyebrowKey?: string;
  actions?: React.ReactNode;
}) {
  const t = useT();
  return (
    <PageHeader
      title={t(titleKey)}
      description={description ?? (descriptionKey ? t(descriptionKey) : undefined)}
      eyebrow={
        eyebrowKey ? (
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            {t(eyebrowKey)}
          </span>
        ) : undefined
      }
      actions={actions}
    />
  );
}

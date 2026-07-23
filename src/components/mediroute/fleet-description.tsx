"use client";

import { useT } from "@/lib/i18n/context";

/** The fleet page's description, split around the inline `<code>` path. */
export function FleetDescription() {
  const t = useT();
  return (
    <>
      {t("fleet.deviceSimBefore")}
      <code>/api/ambulances/[id]</code>
      {t("fleet.deviceSimAfter")}
    </>
  );
}

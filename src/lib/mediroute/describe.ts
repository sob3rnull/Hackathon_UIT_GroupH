import type { Hospital } from "./types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Blurb for the public directory card. Prefers the stored description; rows
 * from a database that predates the description seed fall back to a line
 * derived from capacity and specialties, so no card ever renders empty.
 *
 * `t`/`specialtyLabel` are optional so non-UI callers (tests) can omit them;
 * the fallback then renders in English with raw specialty names.
 */
export function describeHospital(
  hospital: Hospital,
  t?: T,
  specialtyLabel?: (specialty: string) => string,
): string {
  if (hospital.description) return hospital.description;
  const specialties = hospital.specialties
    .slice(0, 3)
    .map((s) => specialtyLabel?.(s) ?? s)
    .join(", ");
  return t
    ? t("home.fallbackDescription", { beds: hospital.total_beds, specialties })
    : `${hospital.total_beds}-bed hospital in Yangon offering ${specialties}.`;
}

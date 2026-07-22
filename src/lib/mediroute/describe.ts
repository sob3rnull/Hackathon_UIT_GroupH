import type { Hospital } from "./types";

/**
 * Blurb for the public directory card. Prefers the stored description; rows
 * from a database that predates the description seed fall back to a line
 * derived from capacity and specialties, so no card ever renders empty.
 */
export function describeHospital(hospital: Hospital): string {
  if (hospital.description) return hospital.description;
  const specialties = hospital.specialties.slice(0, 3).join(", ");
  return `${hospital.total_beds}-bed hospital in Yangon offering ${specialties}.`;
}

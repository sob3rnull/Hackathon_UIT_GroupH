import type { AmbulanceStatus } from "@/lib/mediroute/types";
import type { Locale } from "./context";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Rebuilds a plain-language reason/rejection string from the ranking engine
 * (`src/lib/mediroute/engine.ts`) in the active locale.
 *
 * The engine itself stays English-only and untouched — it's covered by
 * parity tests against the n8n backend, and its output also feeds
 * `isCaution()`'s substring/regex matching in `reasons.tsx`. Changing the
 * engine's strings would risk both. Instead this regex-parses the known
 * English templates and re-renders them through the dictionary; for
 * `locale === "en"` it's a no-op passthrough, so English behavior is
 * byte-for-byte unchanged.
 */
export function translateReason(reason: string, t: T, locale: Locale): string {
  if (locale === "en") return reason;

  const specialty = (raw: string) => t(`status.specialty.${raw}`) ?? raw;
  const status = (raw: string) => t(`status.ambulance.${raw as AmbulanceStatus}`) ?? raw;

  let match: RegExpMatchArray | null;

  if ((match = reason.match(/^(\d+) min away \(([\d.]+) km\)$/))) {
    return t("reasons.minAway", { eta: match[1], km: match[2] });
  }
  if ((match = reason.match(/^(\d+) beds? free$/))) {
    return t("reasons.bedsFree", { count: match[1] });
  }
  if ((match = reason.match(/^(\d+) (.+) specialists? on duty$/))) {
    return t("reasons.specialistsOnDuty", { count: match[1], specialty: specialty(match[2]) });
  }
  if ((match = reason.match(/^No (.+) specialist on duty$/))) {
    return t("reasons.noSpecialistOnDuty", { specialty: specialty(match[1]) });
  }
  if ((match = reason.match(/^ER at (\d+)% capacity$/))) {
    return t("reasons.erAtCapacity", { percent: match[1] });
  }
  if ((match = reason.match(/^(\d+) ICU beds? free$/))) {
    return t("reasons.icuBedsFree", { count: match[1] });
  }
  if (reason === "No ICU bed free") {
    return t("reasons.noIcuBedFree");
  }
  if ((match = reason.match(/^No (.+) service$/))) {
    return t("reasons.noSpecialtyService", { specialty: specialty(match[1]) });
  }
  if (reason === "No available beds") {
    return t("reasons.noAvailableBeds");
  }
  if (reason === "Not certified") {
    return t("reasons.notCertified");
  }
  if (reason === "No IoT unit fitted — not certified") {
    return t("reasons.noIotUnit");
  }
  if ((match = reason.match(/^Unavailable \((.+)\)$/))) {
    return t("reasons.unavailableStatus", { status: status(match[1]) });
  }
  if (reason === "No GPS position reported") {
    return t("reasons.noGpsPosition");
  }
  if ((match = reason.match(/^GPS fix (\d+) min old$/))) {
    return t("reasons.gpsFixOld", { minutes: match[1] });
  }
  if (reason === "No GPS fix timestamp") {
    return t("reasons.noGpsTimestamp");
  }

  // Unrecognized shape (e.g. a future engine change) — show English rather
  // than a broken translation.
  return reason;
}

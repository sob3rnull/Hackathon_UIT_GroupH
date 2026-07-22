import { etaMinutes, haversineKm } from "./geo";
import type {
  Ambulance,
  AmbulanceCandidate,
  AmbulanceRejection,
  AmbulanceSelection,
  Excluded,
  Hospital,
  LatLng,
  Ranked,
  Recommendation,
  Severity,
  Triage,
} from "./types";

/**
 * The matching engine. Pure — hospitals + triage + origin in, ranking out.
 * No I/O, no framework, no clock. That's what makes it unit-testable, and
 * the tests are the only thing standing between you and demoing a ranking
 * that is silently backwards.
 */

/** Travel time at or beyond this many minutes scores zero. */
export const UNACCEPTABLE_MINUTES = 45;

/**
 * A GPS fix older than this is treated as no fix at all — the vehicle may have
 * moved far from where the system thinks it is, and dispatching on a stale
 * position is worse than not dispatching.
 */
export const STALE_GPS_MINUTES = 10;

/** Specialists on duty needed to score full marks on the doctor term. */
const DOCTORS_FOR_FULL_SCORE = 2;

/**
 * Weights per severity. Every term is normalized 0..1 where higher is better,
 * so these are directly comparable. Critical leans on travel time; stable
 * leans away from congested ERs because the patient can afford the drive.
 */
export const WEIGHTS: Record<
  Severity,
  { travel: number; beds: number; doctors: number; erLoad: number }
> = {
  critical: { travel: 0.5, beds: 0.2, doctors: 0.2, erLoad: 0.1 },
  urgent: { travel: 0.4, beds: 0.25, doctors: 0.2, erLoad: 0.15 },
  stable: { travel: 0.25, beds: 0.3, doctors: 0.15, erLoad: 0.3 },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Travel scored against a fixed 45-minute reference rather than min-max
 * normalized across candidates. Min-max divides by zero when only one
 * hospital is eligible — which happens in the mass-casualty scenario.
 */
function travelScore(minutes: number) {
  return clamp01(1 - minutes / UNACCEPTABLE_MINUTES);
}

function doctorCount(hospital: Hospital, specialty: string) {
  return hospital.doctors_on_duty?.[specialty] ?? 0;
}

/**
 * Hard eligibility. Returns a reason string when the hospital is disqualified,
 * or null when it survives. Separated from scoring because these are not
 * penalties — a hospital with no cardiologist is not a worse choice for a
 * coding cardiac patient, it is not a choice at all.
 */
function disqualify(
  hospital: Hospital,
  triage: Triage,
  applyCriticalRules: boolean,
): string | null {
  if (!hospital.specialties.includes(triage.requiredSpecialty)) {
    return `No ${triage.requiredSpecialty} service`;
  }
  if (hospital.available_beds <= 0) {
    return "No available beds";
  }
  if (applyCriticalRules) {
    if (doctorCount(hospital, triage.requiredSpecialty) <= 0) {
      return `No ${triage.requiredSpecialty} specialist on duty`;
    }
    if (triage.needsICU && hospital.icu_beds_free <= 0) {
      return "No ICU bed free";
    }
  }
  return null;
}

function scoreOne(
  hospital: Hospital,
  triage: Triage,
  distanceKm: number,
  eta: number,
): Ranked {
  const weights = WEIGHTS[triage.severity];
  const specialists = doctorCount(hospital, triage.requiredSpecialty);

  const parts = {
    travel: travelScore(eta),
    beds:
      hospital.total_beds > 0
        ? clamp01(hospital.available_beds / hospital.total_beds)
        : 0,
    doctors: clamp01(specialists / DOCTORS_FOR_FULL_SCORE),
    erLoad:
      hospital.er_capacity > 0
        ? clamp01(1 - hospital.current_er_queue / hospital.er_capacity)
        : 0,
  };

  const score =
    weights.travel * parts.travel +
    weights.beds * parts.beds +
    weights.doctors * parts.doctors +
    weights.erLoad * parts.erLoad;

  const erPercent = hospital.er_capacity
    ? Math.round((hospital.current_er_queue / hospital.er_capacity) * 100)
    : 0;

  const reasons = [
    `${Math.round(eta)} min away (${distanceKm.toFixed(1)} km)`,
    `${hospital.available_beds} bed${hospital.available_beds === 1 ? "" : "s"} free`,
    specialists > 0
      ? `${specialists} ${triage.requiredSpecialty} specialist${specialists === 1 ? "" : "s"} on duty`
      : `No ${triage.requiredSpecialty} specialist on duty`,
    `ER at ${erPercent}% capacity`,
  ];

  if (triage.needsICU) {
    reasons.push(
      hospital.icu_beds_free > 0
        ? `${hospital.icu_beds_free} ICU bed${hospital.icu_beds_free === 1 ? "" : "s"} free`
        : "No ICU bed free",
    );
  }

  return { hospital, score, distanceKm, etaMinutes: eta, parts, reasons };
}

/**
 * Pick which ambulance to send to the incident. Runs BEFORE hospital ranking:
 * the 119 dispatcher assigns a vehicle, then that vehicle's patient is routed
 * to a hospital.
 *
 * Certification is a hard gate by design — a vehicle without a fitted IoT unit
 * reports no position and cannot be tracked, so the system must not be able to
 * dispatch it even if it happens to be parked next to the patient.
 *
 * `now` is injected rather than read from the clock so this stays pure and the
 * stale-GPS rule is testable.
 */
export function selectAmbulance(
  ambulances: Ambulance[],
  incident: LatLng,
  now: Date = new Date(),
): AmbulanceSelection {
  const candidates: AmbulanceCandidate[] = [];
  const rejected: AmbulanceRejection[] = [];

  for (const ambulance of ambulances) {
    if (!ambulance.certified) {
      rejected.push({
        ambulance,
        reason: ambulance.device_id
          ? "Not certified"
          : "No IoT unit fitted — not certified",
      });
      continue;
    }

    if (ambulance.status !== "available") {
      rejected.push({ ambulance, reason: `Unavailable (${ambulance.status})` });
      continue;
    }

    if (ambulance.lat === null || ambulance.lng === null) {
      rejected.push({ ambulance, reason: "No GPS position reported" });
      continue;
    }

    const fixAgeMinutes = ambulance.gps_fix_at
      ? (now.getTime() - new Date(ambulance.gps_fix_at).getTime()) / 60000
      : Infinity;

    if (!Number.isFinite(fixAgeMinutes) || fixAgeMinutes > STALE_GPS_MINUTES) {
      rejected.push({
        ambulance,
        reason: Number.isFinite(fixAgeMinutes)
          ? `GPS fix ${Math.round(fixAgeMinutes)} min old`
          : "No GPS fix timestamp",
      });
      continue;
    }

    const distanceKm = haversineKm(incident, {
      lat: ambulance.lat,
      lng: ambulance.lng,
    });
    candidates.push({
      ambulance,
      distanceKm,
      responseMinutes: etaMinutes(distanceKm),
    });
  }

  // Nearest first. Crew level is shown to the dispatcher but deliberately not
  // scored — sending a slower advanced unit past a closer basic one is a
  // clinical judgement, not something to bury in a weighting.
  candidates.sort((a, b) => a.responseMinutes - b.responseMinutes);

  return { candidates, rejected };
}

export function recommend(
  hospitals: Hospital[],
  triage: Triage,
  origin: LatLng,
): Recommendation {
  const measured = hospitals.map((hospital) => {
    const distanceKm = haversineKm(origin, hospital);
    return { hospital, distanceKm, eta: etaMinutes(distanceKm) };
  });

  const run = (applyCriticalRules: boolean) => {
    const ranked: Ranked[] = [];
    const excluded: Excluded[] = [];

    for (const { hospital, distanceKm, eta } of measured) {
      const reason = disqualify(hospital, triage, applyCriticalRules);
      if (reason) {
        excluded.push({ hospital, distanceKm, etaMinutes: eta, reason });
      } else {
        ranked.push(scoreOne(hospital, triage, distanceKm, eta));
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    return { ranked, excluded };
  };

  const strict = triage.severity === "critical";
  let { ranked, excluded } = run(strict);
  let relaxed = false;

  // Nothing survived the critical-only rules — fall back rather than return an
  // empty list, and flag it loudly so the dispatcher knows the recommendation
  // is a least-bad option, not a good one.
  if (strict && ranked.length === 0) {
    ({ ranked, excluded } = run(false));
    relaxed = ranked.length > 0;
  }

  return { ranked, excluded, relaxed, triage, origin };
}

import { z } from "zod";

export const conditions = [
  "cardiac",
  "trauma",
  "stroke",
  "burn",
  "obstetric",
  "paediatric",
  "general",
] as const;
export type Condition = (typeof conditions)[number];

export const severities = ["critical", "urgent", "stable"] as const;
export type Severity = (typeof severities)[number];

/** Condition → the hospital service that must be present to treat it. */
export const specialtyFor: Record<Condition, string> = {
  cardiac: "cardiology",
  trauma: "trauma",
  stroke: "neurology",
  burn: "burns",
  obstetric: "obstetrics",
  paediatric: "paediatrics",
  general: "general",
};

/**
 * What the triage step produces. Shared by the AI path and the manual
 * dropdown fallback, so the rest of the system can't tell them apart.
 */
export const triageSchema = z.object({
  condition: z.enum(conditions),
  severity: z.enum(severities),
  requiredSpecialty: z.string(),
  needsICU: z.boolean(),
  /** What drove the call — surfaced in the UI as the explainability trail. */
  redFlags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type Triage = z.infer<typeof triageSchema>;

export interface Hospital {
  id: string;
  name: string;
  short_name: string;
  lat: number;
  lng: number;
  specialties: string[];
  total_beds: number;
  available_beds: number;
  icu_beds_free: number;
  doctors_on_duty: Record<string, number>;
  er_capacity: number;
  current_er_queue: number;
  updated_at: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** A hospital that survived eligibility, with its score broken down. */
export interface Ranked {
  hospital: Hospital;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  parts: {
    travel: number;
    beds: number;
    doctors: number;
    erLoad: number;
  };
  /** Plain-language justification, shown verbatim to the dispatcher. */
  reasons: string[];
}

/** A hospital removed by a hard filter, with the reason kept for display. */
export interface Excluded {
  hospital: Hospital;
  distanceKm: number;
  etaMinutes: number;
  reason: string;
}

export interface Recommendation {
  ranked: Ranked[];
  excluded: Excluded[];
  /**
   * True when no hospital passed the full critical-severity filters and the
   * engine had to drop them to return anything at all. Drives the red banner.
   */
  relaxed: boolean;
  triage: Triage;
  origin: LatLng;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

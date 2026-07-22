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
  /** Public-facing blurb for the directory page. May be empty on old rows. */
  description: string;
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

/* ── Ambulance fleet ───────────────────────────────────────────────────── */

export const ambulanceStatuses = [
  "available",
  "dispatched",
  "on_scene",
  "transporting",
  "offline",
] as const;
export type AmbulanceStatus = (typeof ambulanceStatuses)[number];

export interface Ambulance {
  id: string;
  callsign: string;
  operator: string;
  /** IoT unit fitted to the vehicle. Null means no device installed. */
  device_id: string | null;
  /** Granted only once the device is installed and reporting. */
  certified: boolean;
  lat: number | null;
  lng: number | null;
  gps_fix_at: string | null;
  status: AmbulanceStatus;
  crew_level: "basic" | "advanced";
  updated_at: string;
}

export interface AmbulanceCandidate {
  ambulance: Ambulance;
  distanceKm: number;
  /** Ambulance → incident. The response leg. */
  responseMinutes: number;
}

export interface AmbulanceRejection {
  ambulance: Ambulance;
  reason: string;
}

export interface AmbulanceSelection {
  candidates: AmbulanceCandidate[];
  rejected: AmbulanceRejection[];
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
  /**
   * The incident location. Hospital ETAs are the transport leg from here; the
   * response leg (ambulance → incident) lives on the ambulance candidate.
   * Total time to definitive care is response + transport, not either alone.
   */
  origin: LatLng;
}

/* ── Donations (public page; demo flow, no payment processing) ─────────── */

/** Myanmar wallets + banks + international cards. Recorded, never charged. */
export const paymentMethods = [
  "kbz_pay",
  "aya_pay",
  "wave_money",
  "cb_pay",
  "bank_transfer",
  "card",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  kbz_pay: "KBZPay (K-pay)",
  aya_pay: "AYA Pay",
  wave_money: "Wave Money",
  cb_pay: "CB Pay",
  bank_transfer: "Myanmar bank transfer",
  card: "Credit / Visa card",
};

export interface Donation {
  id: string;
  /** Null means the general fund rather than a specific hospital. */
  hospital_id: string | null;
  donor_name: string;
  amount: number;
  message: string;
  /** One of paymentMethods; empty string on rows from before the field. */
  payment_method: string;
  created_at: string;
}

export interface DonationSummary {
  /** Recent donations, newest first. */
  donations: Donation[];
  /** Running totals keyed by hospital id. */
  totals: Record<string, { total: number; count: number }>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

"use client";

import type { AmbulanceSelection, ApiResult, LatLng, Recommendation, Triage } from "./types";
import type { DispatchRecord } from "./use-dispatches";

/**
 * The one place the frontend decides where the backend lives.
 *
 * Set NEXT_PUBLIC_MEDIROUTE_API to the n8n webhook base (e.g.
 * https://<instance>.app.n8n.cloud/webhook) and every call below goes to the
 * n8n workflow. Leave it blank and the same calls hit the local Next.js route
 * handlers instead.
 *
 * Both paths run the SAME ranking logic — n8n/ranking-core.js is embedded in
 * the workflow's Code node, and src/lib/mediroute/n8n-parity.test.ts asserts
 * it matches the TypeScript engine case for case. Switching backends must not
 * change a single recommendation.
 *
 * Keeping the local path is deliberate demo insurance: n8n Cloud is a network
 * dependency, and if the venue drops it you flip one env var instead of
 * losing the backend entirely.
 */
const N8N_BASE = (process.env.NEXT_PUBLIC_MEDIROUTE_API ?? "").replace(/\/$/, "");

export const backendMode: "n8n" | "local" = N8N_BASE ? "n8n" : "local";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export interface TriageResponse {
  triage: Triage;
  source: "claude" | "keyword";
  note?: string | null;
}

export async function runTriage(note: string): Promise<TriageResponse> {
  return postJson<TriageResponse>(
    N8N_BASE ? `${N8N_BASE}/mediroute/triage` : "/api/triage",
    { note },
  );
}

/**
 * A neutral stand-in for the n8n /mediroute/plan contract, which requires a
 * triage object in its body. selectAmbulance() never reads it — fleet
 * ranking only needs the incident location — so the dispatcher, who no
 * longer runs triage at all, has nothing real to put here. Never shown to a
 * user; exists purely to satisfy an API shape that predates this split.
 */
const NEUTRAL_TRIAGE: Triage = {
  condition: "general",
  severity: "urgent",
  requiredSpecialty: "general",
  needsICU: false,
  redFlags: [],
  confidence: 0,
};

/**
 * Ranked ambulances for an incident. The dispatcher's whole job is this list
 * plus a pick — triage and hospital ranking both happen later, on the crew's
 * own screen, which is why this takes no triage argument.
 *
 * Locally this is a dedicated endpoint that never needed triage. n8n only
 * exposes the combined /mediroute/plan webhook, so there the same call that
 * would answer a full plan is made (with NEUTRAL_TRIAGE, since the webhook
 * requires something) and only its `fleet` half is kept.
 */
export async function getFleetPlan(incident: LatLng): Promise<AmbulanceSelection> {
  if (N8N_BASE) {
    const plan = await postJson<{ fleet: AmbulanceSelection }>(
      `${N8N_BASE}/mediroute/plan`,
      { triage: NEUTRAL_TRIAGE, incident },
    );
    return plan.fleet;
  }
  return postJson<AmbulanceSelection>("/api/ambulances", { incident });
}

/**
 * Ranked hospitals for an incident. Called from the Ambulance page once a
 * crew's mission has no hospital_id yet — the mirror image of getFleetPlan.
 */
export async function getHospitalPlan(
  triage: Triage,
  incident: LatLng,
): Promise<Recommendation> {
  if (N8N_BASE) {
    const plan = await postJson<{ hospitals: Recommendation }>(
      `${N8N_BASE}/mediroute/plan`,
      { triage, incident },
    );
    return plan.hospitals;
  }
  return postJson<Recommendation>("/api/recommend", { triage, origin: incident });
}

export interface AssignAmbulancePayload {
  ambulance_id: string;
  patient_note: string;
  response_eta_minutes: number;
  incident_lat: number;
  incident_lng: number;
  input_mode: "text" | "voice";
}

/**
 * The dispatcher's one write: picks a vehicle, creates the dispatch record
 * with no hospital and no real triage yet — the dispatcher never runs
 * triage, so there's nothing true to put in those columns. They get
 * DB-schema-matching placeholders here (explicit, not left to whichever
 * backend's own defaulting happens to kick in) and real values once the
 * crew confirms. Marks the ambulance "dispatched" server-side so it drops
 * out of the available pool immediately.
 */
export async function assignAmbulance(
  payload: AssignAmbulancePayload,
): Promise<DispatchRecord> {
  return postJson<DispatchRecord>(
    N8N_BASE ? `${N8N_BASE}/mediroute/dispatch` : "/api/dispatch",
    {
      ...payload,
      hospital_id: null,
      recommended_hospital_id: null,
      eta_minutes: 0,
      condition: "general",
      severity: "urgent",
      required_specialty: "general",
      needs_icu: false,
    },
  );
}

export interface ConfirmMissionPayload {
  dispatch_id: string;
  patient_note: string;
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  hospital_id: string;
  recommended_hospital_id: string | null;
  eta_minutes: number;
}

/**
 * The crew's one write: the triage they ran themselves, and the hospital
 * they picked against it. Fills in everything assignAmbulance left as a
 * placeholder, on the same row.
 */
export async function confirmMission(
  payload: ConfirmMissionPayload,
): Promise<DispatchRecord> {
  return postJson<DispatchRecord>(
    N8N_BASE ? `${N8N_BASE}/mediroute/dispatch/confirm` : "/api/dispatch/confirm",
    payload,
  );
}

export interface RouteResult {
  etaMinutes: number;
  distanceKm: number;
  /** Encoded polyline, Google's standard algorithm — decode client-side. */
  polyline: string;
}

/**
 * Real road geometry for one leg, for the ambulance page's route map. Always
 * local — this is a rendering concern, not part of the ranking pipeline, so
 * it has no n8n equivalent regardless of backendMode.
 *
 * Never throws: a missing key or a Google-side failure returns null, and the
 * map falls back to a straight line rather than breaking the page.
 */
export async function getRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<RouteResult | null> {
  try {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    });
    const result = (await response.json()) as ApiResult<RouteResult>;
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

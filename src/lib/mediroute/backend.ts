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
 * Ranked ambulances for an incident. The dispatcher's whole job is this list
 * plus a pick — hospital ranking happens later, on the crew's own screen.
 *
 * Locally this is a dedicated endpoint that doesn't need triage at all. n8n
 * only exposes the combined /mediroute/plan webhook, so there the same call
 * that would answer a full plan is made and only its `fleet` half is kept —
 * one extra hospital-ranking computation on n8n's side, discarded here, which
 * is cheaper than standing up a second n8n webhook for a subset of a call
 * that already exists.
 */
export async function getFleetPlan(
  triage: Triage,
  incident: LatLng,
): Promise<AmbulanceSelection> {
  if (N8N_BASE) {
    const plan = await postJson<{ fleet: AmbulanceSelection }>(
      `${N8N_BASE}/mediroute/plan`,
      { triage, incident },
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
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  response_eta_minutes: number;
  incident_lat: number;
  incident_lng: number;
  input_mode: "text" | "voice";
}

/**
 * The dispatcher's one write: picks a vehicle, creates the dispatch record
 * with no hospital yet. Marks the ambulance "dispatched" server-side so it
 * drops out of the available pool immediately.
 */
export async function assignAmbulance(
  payload: AssignAmbulancePayload,
): Promise<DispatchRecord> {
  return postJson<DispatchRecord>(
    N8N_BASE ? `${N8N_BASE}/mediroute/dispatch` : "/api/dispatch",
    { ...payload, hospital_id: null, recommended_hospital_id: null, eta_minutes: 0 },
  );
}

export interface ChooseHospitalPayload {
  dispatch_id: string;
  hospital_id: string;
  recommended_hospital_id: string | null;
  eta_minutes: number;
}

/** The crew's write: fills in the hospital on the row assignAmbulance created. */
export async function chooseHospital(
  payload: ChooseHospitalPayload,
): Promise<DispatchRecord> {
  return postJson<DispatchRecord>(
    N8N_BASE
      ? `${N8N_BASE}/mediroute/dispatch/choose-hospital`
      : "/api/dispatch/choose-hospital",
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

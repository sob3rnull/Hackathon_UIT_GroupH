"use client";

import type { AmbulanceSelection, ApiResult, LatLng, Recommendation, Triage } from "./types";
import type { DispatchRecord } from "./use-dispatches";

/**
 * Every call below hits the native Next.js API routes (/api/*). The n8n backend
 * has been retired — NEXT_PUBLIC_MEDIROUTE_API is no longer read, so a stale
 * value in a deployment can't route traffic back to a dead webhook. (The n8n
 * /mediroute/plan webhook was returning an empty 200, which surfaced on the
 * client as "JSON.parse: unexpected end of data".)
 */
export const backendMode: "n8n" | "local" = "local";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Read as text first: an empty or non-JSON body (e.g. a proxy error page, or
  // the old n8n webhook's empty 200) must become a clear error, not a raw
  // "JSON.parse: unexpected end of data" in front of the user.
  const text = await response.text();
  let result: ApiResult<T>;
  try {
    result = JSON.parse(text) as ApiResult<T>;
  } catch {
    throw new Error(
      `Backend returned a non-JSON response (${response.status})${
        text ? `: ${text.slice(0, 120)}` : " — empty body"
      }`,
    );
  }
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export interface TriageResponse {
  triage: Triage;
  source: "claude" | "keyword";
  note?: string | null;
}

export async function runTriage(note: string): Promise<TriageResponse> {
  // /api/triage runs Claude (Haiku) directly with ANTHROPIC_API_KEY.
  return postJson<TriageResponse>("/api/triage", { note });
}

/**
 * A neutral stand-in for the /api/plan contract, which requires a triage
 * object in its body. selectAmbulance() never reads it — fleet
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
 * /api/plan is a combined fleet+hospital endpoint that requires a triage
 * object, so the call sends NEUTRAL_TRIAGE and keeps only the `fleet` half.
 */
export async function getFleetPlan(incident: LatLng): Promise<AmbulanceSelection> {
  const plan = await postJson<{ fleet: AmbulanceSelection }>("/api/plan", {
    triage: NEUTRAL_TRIAGE,
    incident,
  });
  return plan.fleet;
}

/**
 * Ranked hospitals for an incident. Called from the Ambulance page once a
 * crew's mission has no hospital_id yet — the mirror image of getFleetPlan.
 */
export async function getHospitalPlan(
  triage: Triage,
  incident: LatLng,
): Promise<Recommendation> {
  const plan = await postJson<{ hospitals: Recommendation }>("/api/plan", {
    triage,
    incident,
  });
  return plan.hospitals;
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
    "/api/dispatch",
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
  return postJson<DispatchRecord>("/api/dispatch/confirm", payload);
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

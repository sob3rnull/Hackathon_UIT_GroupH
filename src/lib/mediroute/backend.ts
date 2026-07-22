"use client";

import type {
  AmbulanceSelection,
  ApiResult,
  LatLng,
  Recommendation,
  Triage,
} from "./types";

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

export interface Plan {
  incident: LatLng;
  fleet: AmbulanceSelection;
  hospitals: Recommendation;
}

/**
 * One planning call. n8n answers it in a single round trip; locally it is two
 * endpoints, composed here so callers see one shape either way.
 */
export async function getPlan(triage: Triage, incident: LatLng): Promise<Plan> {
  if (N8N_BASE) {
    return postJson<Plan>(`${N8N_BASE}/mediroute/plan`, { triage, incident });
  }

  const [fleet, hospitals] = await Promise.all([
    postJson<AmbulanceSelection>("/api/ambulances", { incident }),
    postJson<Recommendation>("/api/recommend", { triage, origin: incident }),
  ]);
  return { incident, fleet, hospitals };
}

export interface DispatchPayload {
  hospital_id: string;
  recommended_hospital_id: string | null;
  ambulance_id: string | null;
  patient_note: string;
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  eta_minutes: number;
  response_eta_minutes: number;
  incident_lat: number;
  incident_lng: number;
  input_mode: "text" | "voice";
}

export async function sendDispatch(payload: DispatchPayload) {
  return postJson<{ id: string }>(
    N8N_BASE ? `${N8N_BASE}/mediroute/dispatch` : "/api/dispatch",
    payload,
  );
}

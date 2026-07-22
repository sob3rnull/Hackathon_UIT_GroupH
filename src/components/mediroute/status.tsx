import { Badge } from "@/components/ui/badge";
import type { AmbulanceStatus, Hospital, Severity } from "@/lib/mediroute/types";

/**
 * One vocabulary for every status shown anywhere in the app.
 *
 * Nothing here invents new state — it translates the values the database
 * already stores into the words a dispatcher, nurse or paramedic would use,
 * so the same vehicle reads identically on all four screens.
 */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/* ── Severity ──────────────────────────────────────────────────────────── */

export const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  urgent: "warning",
  stable: "success",
};

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const tone = severityTone[severity as Severity] ?? "neutral";
  return <Badge tone={tone}>{severity}</Badge>;
}

/* ── Ambulance ─────────────────────────────────────────────────────────── */

/** Crew-facing wording for the stored enum. Values are unchanged. */
export const ambulanceStatusLabel: Record<AmbulanceStatus, string> = {
  available: "Available",
  dispatched: "En route to scene",
  on_scene: "On scene",
  transporting: "Transporting patient",
  offline: "Out of service",
};

const ambulanceStatusTone: Record<AmbulanceStatus, Tone> = {
  available: "success",
  dispatched: "warning",
  on_scene: "accent",
  transporting: "accent",
  offline: "neutral",
};

export function AmbulanceStatusBadge({ status }: { status: AmbulanceStatus }) {
  return (
    <Badge tone={ambulanceStatusTone[status] ?? "neutral"}>
      {ambulanceStatusLabel[status] ?? status}
    </Badge>
  );
}

/**
 * The run a crew works through from here, mapped onto the statuses the
 * schema already allows. Deliberately doesn't include "dispatched" — a
 * vehicle is already dispatched the moment it's assigned (set server-side,
 * so it drops out of the available pool immediately), so there is no
 * separate "accept" action left for the crew to press. The current status is
 * still shown in plain words above this list; it just isn't one of these
 * buttons.
 */
export const crewStages = [
  { status: "on_scene", action: "Arrived on scene", done: "On scene" },
  { status: "transporting", action: "Patient loaded", done: "Transporting" },
  { status: "available", action: "Complete run", done: "Complete" },
] as const satisfies ReadonlyArray<{
  status: AmbulanceStatus;
  action: string;
  done: string;
}>;

/* ── Hospital ──────────────────────────────────────────────────────────── */

export interface HospitalStatus {
  label: string;
  tone: Tone;
  /** Why it reads that way, in the same plain language as the ranking. */
  detail: string;
}

/**
 * Derived from live capacity, not stored. Mirrors the thresholds the ranking
 * engine already applies, so a hospital marked "Diverting" here is the same
 * one the dispatcher sees filtered out.
 */
export function hospitalStatus(hospital: Hospital): HospitalStatus {
  const erLoad = hospital.er_capacity
    ? hospital.current_er_queue / hospital.er_capacity
    : 0;

  if (hospital.available_beds === 0) {
    return { label: "Diverting", tone: "danger", detail: "No beds available" };
  }
  if (erLoad >= 1) {
    return { label: "Diverting", tone: "danger", detail: "ER over capacity" };
  }
  if (erLoad >= 0.75 || hospital.icu_beds_free === 0) {
    return {
      label: "Near capacity",
      tone: "warning",
      detail: hospital.icu_beds_free === 0 ? "No ICU beds free" : "ER filling up",
    };
  }
  return { label: "Accepting", tone: "success", detail: "Beds and ER capacity free" };
}

export function HospitalStatusBadge({ hospital }: { hospital: Hospital }) {
  const status = hospitalStatus(hospital);
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

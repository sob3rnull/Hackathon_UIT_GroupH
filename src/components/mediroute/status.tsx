"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/context";
import type { AmbulanceStatus, Hospital, Severity } from "@/lib/mediroute/types";

/**
 * One vocabulary for every status shown anywhere in the app.
 *
 * Nothing here invents new state — it translates the values the database
 * already stores into the words a dispatcher, nurse or paramedic would use,
 * so the same vehicle reads identically on all four screens. The exported
 * keys (not display strings) are what callers should compare against —
 * `hospitalStatus()` in particular is read elsewhere for logic, not just
 * display, so its `labelKey` stays a stable English identifier regardless
 * of the active language; only `HospitalStatusBadge` translates it.
 */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/* ── Severity ──────────────────────────────────────────────────────────── */

export const severityTone: Record<Severity, Tone> = {
  critical: "danger",
  urgent: "warning",
  stable: "success",
};

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const t = useT();
  const tone = severityTone[severity as Severity] ?? "neutral";
  const label = severity in severityTone ? t(`status.severity.${severity}`) : severity;
  return <Badge tone={tone}>{label}</Badge>;
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

/** `t("status.ambulance." + status)` — use this instead of the raw map above when rendering. */
export function useAmbulanceStatusLabel() {
  const t = useT();
  return (status: AmbulanceStatus) => t(`status.ambulance.${status}`);
}

export function AmbulanceStatusBadge({ status }: { status: AmbulanceStatus }) {
  const t = useT();
  return (
    <Badge tone={ambulanceStatusTone[status] ?? "neutral"}>
      {t(`status.ambulance.${status}`) ?? status}
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
  { status: "on_scene", actionKey: "status.crewStageOnSceneAction", doneKey: "status.crewStageOnSceneDone" },
  { status: "transporting", actionKey: "status.crewStageTransportingAction", doneKey: "status.crewStageTransportingDone" },
  { status: "available", actionKey: "status.crewStageCompleteAction", doneKey: "status.crewStageCompleteDone" },
] as const satisfies ReadonlyArray<{
  status: AmbulanceStatus;
  actionKey: string;
  doneKey: string;
}>;

/* ── Hospital ──────────────────────────────────────────────────────────── */

export type HospitalStatusKey = "diverting" | "nearCapacity" | "accepting";
export type HospitalDetailKey = "noBeds" | "erOverCapacity" | "noIcu" | "erFilling" | "capacityFree";

export interface HospitalStatus {
  labelKey: HospitalStatusKey;
  tone: Tone;
  detailKey: HospitalDetailKey;
}

/**
 * Derived from live capacity, not stored. Mirrors the thresholds the ranking
 * engine already applies, so a hospital marked "diverting" here is the same
 * one the dispatcher sees filtered out. Returns stable keys, not display
 * strings — translate with `t("status.hospital." + labelKey)` /
 * `t("status.hospitalDetail." + detailKey)` at the point of display.
 */
export function hospitalStatus(hospital: Hospital): HospitalStatus {
  const erLoad = hospital.er_capacity
    ? hospital.current_er_queue / hospital.er_capacity
    : 0;

  if (hospital.available_beds === 0) {
    return { labelKey: "diverting", tone: "danger", detailKey: "noBeds" };
  }
  if (erLoad >= 1) {
    return { labelKey: "diverting", tone: "danger", detailKey: "erOverCapacity" };
  }
  if (erLoad >= 0.75 || hospital.icu_beds_free === 0) {
    return {
      labelKey: "nearCapacity",
      tone: "warning",
      detailKey: hospital.icu_beds_free === 0 ? "noIcu" : "erFilling",
    };
  }
  return { labelKey: "accepting", tone: "success", detailKey: "capacityFree" };
}

export function HospitalStatusBadge({ hospital }: { hospital: Hospital }) {
  const t = useT();
  const status = hospitalStatus(hospital);
  return <Badge tone={status.tone}>{t(`status.hospital.${status.labelKey}`)}</Badge>;
}

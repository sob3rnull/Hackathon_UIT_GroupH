"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/ui/states";
import { Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { googleMapsAvailable } from "@/components/mediroute/google-map";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { getPlan, runTriage, sendDispatch } from "@/lib/mediroute/backend";
import {
  specialtyFor,
  type AmbulanceSelection,
  type LatLng,
  type Recommendation as RecommendationResult,
  type Triage,
} from "@/lib/mediroute/types";
import { AmbulanceList } from "./ambulance-list";
import { HospitalList } from "./hospital-list";
import { IncidentTimeline, type TimelineStep } from "./incident-timeline";
import { IntakePanel } from "./intake-panel";
import { MapPanel } from "./map-panel";
import { Recommendation } from "./recommendation";
import { TriageSummary, type TriageSource } from "./triage-summary";

const DEFAULT_INCIDENT: LatLng = { lat: 16.7769, lng: 96.1592 };

const EXAMPLE =
  "55M, crushing central chest pain radiating to left arm, diaphoretic, BP 90/60, GCS 14";

/** Timestamps for the timeline. Written in handlers, never during render. */
interface Marks {
  call: number | null;
  triaged: number | null;
  planned: number | null;
  dispatched: number | null;
}

const NO_MARKS: Marks = { call: null, triaged: null, planned: null, dispatched: null };

/**
 * The dispatch console.
 *
 * This component owns state and sequencing only; every section it renders is a
 * sibling module in this folder. It talks to the backend through
 * lib/mediroute/backend.ts, which decides whether that means n8n or the local
 * route handlers — the ranking itself lives in neither place and is untouched
 * by anything here.
 */
export function Dispatcher() {
  const { hospitals, loading, error, live, revision } = useHospitals();
  const { ambulances, revision: fleetRevision } = useFleet();
  const toast = useToast();

  const [incident, setIncident] = useState<LatLng>(DEFAULT_INCIDENT);

  const [note, setNote] = useState(EXAMPLE);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [source, setSource] = useState<TriageSource>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);

  const [fleetPick, setFleetPick] = useState<AmbulanceSelection | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);

  const [rec, setRec] = useState<RecommendationResult | null>(null);
  const [ranking, setRanking] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Marks>(NO_MARKS);

  /**
   * A snapshot, not a pointer. Confirming a dispatch flips the vehicle to
   * "transporting", which drops it out of the next plan — without the snapshot
   * the confirmation banner would erase itself a second after appearing.
   */
  const [dispatched, setDispatched] = useState<{
    hospital: string;
    callsign: string | null;
    response: number;
    transport: number;
  } | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  // Google map when a key exists; drops to the offline SVG on load failure or
  // by hand. The toggle exists so the offline path can be rehearsed, not
  // discovered live on stage.
  const [mapMode, setMapMode] = useState<"google" | "svg">(
    googleMapsAvailable ? "google" : "svg",
  );

  useEffect(() => {
    fetch("/api/triage")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r?.data?.aiAvailable ?? false))
      .catch(() => setAiAvailable(false));
  }, []);

  /**
   * One planning call covers both steps of the 119 flow: which vehicle goes to
   * the patient, and which hospital the patient goes to. n8n answers it in a
   * single round trip; the local backend composes the same shape from two
   * routes. See lib/mediroute/backend.ts.
   */
  const rank = useCallback(async (t: Triage, at: LatLng, silent = false) => {
    if (!silent) setRanking(true);
    setActionError(null);
    try {
      const plan = await getPlan(t, at);

      setFleetPick(plan.fleet);
      setAssignedId((current) =>
        current && plan.fleet.candidates.some((c) => c.ambulance.id === current)
          ? current
          : (plan.fleet.candidates[0]?.ambulance.id ?? null),
      );

      setRec(plan.hospitals);
      setSelectedId((current) =>
        current && plan.hospitals.ranked.some((r) => r.hospital.id === current)
          ? current
          : (plan.hospitals.ranked[0]?.hospital.id ?? null),
      );

      setMarks((current) => ({ ...current, planned: current.planned ?? Date.now() }));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Planning failed");
    } finally {
      setRanking(false);
    }
  }, []);

  // Live re-plan when hospital capacity or fleet status changes elsewhere.
  //
  // Debounced 1.2s: each plan call costs real Google Routes elements, and a
  // staff member clicking a bed counter five times fires five realtime events.
  // The cleanup cancels the pending call on every new event, so a burst
  // coalesces into ONE Routes call after the clicking stops. The banner still
  // appears immediately so the dispatcher knows a change is inbound.
  useEffect(() => {
    if ((revision === 0 && fleetRevision === 0) || !triage) return;
    // Reacting to an external realtime event (a change on another machine) —
    // the documented escape hatch for this rule. Once per event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleNotice(true);
    const planTimer = setTimeout(() => void rank(triage, incident, true), 1200);
    const noticeTimer = setTimeout(() => setStaleNotice(false), 4000);
    return () => {
      clearTimeout(planTimer);
      clearTimeout(noticeTimer);
    };
  }, [revision, fleetRevision, triage, incident, rank]);

  async function handleTriage() {
    setTriaging(true);
    setActionError(null);
    setDispatched(null);
    setMarks({ ...NO_MARKS, call: Date.now() });

    try {
      const result = await runTriage(note);

      setTriage(result.triage);
      setSource(result.source);
      setSourceNote(result.note ?? null);
      setMarks((current) => ({ ...current, triaged: Date.now() }));

      await rank(result.triage, incident);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Triage failed");
    } finally {
      setTriaging(false);
    }
  }

  function patchTriage(patch: Partial<Triage>) {
    if (!triage) return;
    const next: Triage = { ...triage, ...patch };
    if (patch.condition) next.requiredSpecialty = specialtyFor[patch.condition];
    setTriage(next);
    setSource("manual");
    setSourceNote(null);
    setDispatched(null);
    void rank(next, incident);
  }

  function moveIncident(point: LatLng) {
    setIncident(point);
    setDispatched(null);
    if (triage) void rank(triage, point);
  }

  async function confirmDispatch() {
    if (!rec || !selectedId) return;
    const chosen = rec.ranked.find((r) => r.hospital.id === selectedId);
    if (!chosen) return;

    const assignedCandidate = fleetPick?.candidates.find(
      (c) => c.ambulance.id === assignedId,
    );

    setActionError(null);
    try {
      await sendDispatch({
        hospital_id: chosen.hospital.id,
        recommended_hospital_id: rec.ranked[0]?.hospital.id ?? null,
        ambulance_id: assignedCandidate?.ambulance.id ?? null,
        patient_note: note,
        condition: rec.triage.condition,
        severity: rec.triage.severity,
        required_specialty: rec.triage.requiredSpecialty,
        needs_icu: rec.triage.needsICU,
        eta_minutes: Math.round(chosen.etaMinutes),
        response_eta_minutes: Math.round(assignedCandidate?.responseMinutes ?? 0),
        incident_lat: incident.lat,
        incident_lng: incident.lng,
        input_mode: inputMode,
      });

      setDispatched({
        hospital: chosen.hospital.name,
        callsign: assignedCandidate?.ambulance.callsign ?? null,
        response: Math.round(assignedCandidate?.responseMinutes ?? 0),
        transport: Math.round(chosen.etaMinutes),
      });
      setMarks((current) => ({ ...current, dispatched: Date.now() }));

      toast({
        title: `${assignedCandidate?.ambulance.callsign ?? "Ambulance"} dispatched`,
        description: `${chosen.hospital.short_name} pre-alerted.`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Dispatch failed";
      setActionError(message);
      toast({ title: "Dispatch failed", description: message, tone: "danger" });
    }
  }

  const excludedIds = new Set(rec?.excluded.map((e) => e.hospital.id) ?? []);
  const topId = rec?.ranked[0]?.hospital.id ?? null;
  const assigned = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);
  const chosen = rec?.ranked.find((r) => r.hospital.id === selectedId);

  const timeline: TimelineStep[] = [
    {
      label: "Call received",
      at: marks.call,
      detail: marks.call ? note.slice(0, 80) : "Waiting for a 119 call",
    },
    {
      label: "Triage complete",
      at: marks.triaged,
      detail: triage
        ? `${triage.severity} ${triage.condition} · needs ${triage.requiredSpecialty}${
            triage.needsICU ? " · ICU" : ""
          }`
        : null,
    },
    {
      label: "Ambulance assigned",
      at: marks.planned,
      detail: assigned
        ? `${assigned.ambulance.callsign} · ${Math.round(assigned.responseMinutes)} min to scene`
        : null,
    },
    {
      label: "Hospital selected",
      at: marks.planned,
      detail: chosen
        ? `${chosen.hospital.short_name} · ${Math.round(chosen.etaMinutes)} min transport`
        : null,
    },
    {
      label: "Dispatched, ER pre-alerted",
      at: marks.dispatched,
      detail: dispatched ? `${dispatched.callsign ?? "Ambulance"} → ${dispatched.hospital}` : null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {error ? <ErrorState message={error} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      {/* ── Top: the call ────────────────────────────────────────────────── */}
      <Section
        title="Emergency intake"
        description="What the caller reported, and what the AI made of it."
      >
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <IntakePanel
            note={note}
            onNoteChange={setNote}
            onModeChange={setInputMode}
            onRunTriage={handleTriage}
            triaging={triaging}
            aiAvailable={aiAvailable}
          />
          <TriageSummary
            triage={triage}
            source={source}
            sourceNote={sourceNote}
            onPatch={patchTriage}
          />
        </div>
      </Section>

      {/* ── Middle: the decision ─────────────────────────────────────────── */}
      {rec || fleetPick ? (
        <Section
          title="Recommendation"
          description="The system recommends. You decide — and can override either choice below."
        >
          {staleNotice ? (
            <div className="flex items-center gap-2 rounded-card border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
              <Radio className="size-4 shrink-0 text-accent" />
              Hospital capacity changed elsewhere — recommendation updated.
            </div>
          ) : null}

          <Recommendation
            assigned={assigned}
            chosen={chosen}
            isTopHospital={!selectedId || selectedId === topId}
            ranking={ranking}
            relaxed={Boolean(rec?.relaxed)}
            onConfirm={confirmDispatch}
            dispatched={Boolean(dispatched)}
          />

          {dispatched ? (
            <div className="flex items-start gap-2 rounded-card border border-success/40 bg-success/12 px-4 py-3 text-sm">
              <ShieldCheck className="size-4 shrink-0 text-success" />
              <span>
                <strong>{dispatched.callsign ?? "Ambulance"}</strong> dispatched to{" "}
                <strong>{dispatched.hospital}</strong> · pre-alert sent ·{" "}
                {dispatched.response} min to scene, {dispatched.transport} min to
                hospital (total {dispatched.response + dispatched.transport} min to
                definitive care)
              </span>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* ── Bottom: the evidence ─────────────────────────────────────────── */}
      <Section
        title="Situation"
        description="Everything the recommendation was drawn from."
      >
        <div className="flex flex-col gap-4">
          <MapPanel
            hospitals={hospitals}
            ambulances={ambulances}
            incident={incident}
            loading={loading}
            live={live}
            mapMode={mapMode}
            onToggleMapMode={() =>
              setMapMode((m) => (m === "google" ? "svg" : "google"))
            }
            onFallback={() => setMapMode("svg")}
            assignedAmbulanceId={assignedId}
            recommendedId={topId}
            selectedId={selectedId}
            excludedIds={excludedIds}
            onPickOrigin={moveIncident}
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <HospitalList
              rec={rec}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setDispatched(null);
              }}
            />
            <AmbulanceList
              fleet={fleetPick}
              assignedId={assignedId}
              onAssign={(id) => {
                setAssignedId(id);
                setDispatched(null);
              }}
            />
          </div>

          <IncidentTimeline steps={timeline} />
        </div>
      </Section>
    </div>
  );
}

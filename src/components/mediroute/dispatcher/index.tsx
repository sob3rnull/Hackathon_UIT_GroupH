"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { ErrorState } from "@/components/ui/states";
import { Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { googleMapsAvailable } from "@/components/mediroute/google-map";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { useDispatches } from "@/lib/mediroute/use-dispatches";
import { assignAmbulance, getFleetPlan, runTriage } from "@/lib/mediroute/backend";
import {
  specialtyFor,
  type AmbulanceSelection,
  type LatLng,
  type Triage,
} from "@/lib/mediroute/types";
import { AmbulanceList } from "./ambulance-list";
import { AssignmentPanel } from "./assignment-panel";
import { IncidentTimeline, type TimelineStep } from "./incident-timeline";
import { IntakePanel } from "./intake-panel";
import { MapPanel } from "./map-panel";
import { TriageSummary, type TriageSource } from "./triage-summary";

const DEFAULT_INCIDENT: LatLng = { lat: 16.7769, lng: 96.1592 };

const EXAMPLE =
  "55M, crushing central chest pain radiating to left arm, diaphoretic, BP 90/60, GCS 14";

/** Timestamps for the timeline. Written in handlers or the poll-driven effect below, never during render. */
interface Marks {
  call: number | null;
  triaged: number | null;
  assigned: number | null;
  hospitalChosen: number | null;
}

const NO_MARKS: Marks = { call: null, triaged: null, assigned: null, hospitalChosen: null };

/**
 * The dispatch console.
 *
 * The dispatcher's job ends at assigning a vehicle: take the call, run
 * triage, pick the nearest dispatchable ambulance. Which hospital the patient
 * goes to is the crew's call, made on their own tablet once they're rolling
 * — see ambulance-dashboard.tsx. This component still shows that choice once
 * it's made (polling the same dispatch row it created), but never offers to
 * make it.
 *
 * Talks to the backend through lib/mediroute/backend.ts, which decides
 * whether that means n8n or the local route handlers — the ranking itself
 * lives in neither place and is untouched by anything here.
 */
export function Dispatcher() {
  const { hospitals, loading, error, live } = useHospitals();
  const { ambulances, revision: fleetRevision } = useFleet();
  const { dispatches } = useDispatches();
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
  const [planning, setPlanning] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [assignedDispatchId, setAssignedDispatchId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Marks>(NO_MARKS);

  const [actionError, setActionError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const [mapMode, setMapMode] = useState<"google" | "svg">(
    googleMapsAvailable ? "google" : "svg",
  );

  useEffect(() => {
    fetch("/api/triage")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r?.data?.aiAvailable ?? false))
      .catch(() => setAiAvailable(false));
  }, []);

  const planFleet = useCallback(async (t: Triage, at: LatLng, silent = false) => {
    if (!silent) setPlanning(true);
    setActionError(null);
    try {
      const fleet = await getFleetPlan(t, at);
      setFleetPick(fleet);
      setAssignedId((current) =>
        current && fleet.candidates.some((c) => c.ambulance.id === current)
          ? current
          : (fleet.candidates[0]?.ambulance.id ?? null),
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }, []);

  // Live re-plan when fleet status changes elsewhere — hospital capacity
  // doesn't affect who's dispatchable, so unlike before this only watches
  // fleetRevision. Stops once assigned: this incident's fleet decision is
  // already made, so further fleet churn from OTHER incidents is noise here.
  //
  // Debounced 1.2s for the same reason as the write side of any Routes call:
  // a burst of fleet events should coalesce into one re-plan.
  useEffect(() => {
    if (fleetRevision === 0 || !triage || assignedDispatchId) return;
    // Reacting to an external realtime event (a change on another machine) —
    // the documented escape hatch for this rule. Once per event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleNotice(true);
    const planTimer = setTimeout(() => void planFleet(triage, incident, true), 1200);
    const noticeTimer = setTimeout(() => setStaleNotice(false), 4000);
    return () => {
      clearTimeout(planTimer);
      clearTimeout(noticeTimer);
    };
  }, [fleetRevision, triage, incident, assignedDispatchId, planFleet]);

  // Once assigned, watch the same dispatch row for the crew's hospital pick
  // landing (polled via useDispatches) — the dispatcher can see the decision
  // happen without ever being offered to make it.
  const assignedDispatch = assignedDispatchId
    ? (dispatches.find((d) => d.id === assignedDispatchId) ?? null)
    : null;
  const assignedHospitalName = assignedDispatch?.hospital_id
    ? hospitals.find((h) => h.id === assignedDispatch.hospital_id)?.short_name
    : null;

  useEffect(() => {
    if (assignedHospitalName && marks.hospitalChosen === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarks((current) => ({ ...current, hospitalChosen: Date.now() }));
    }
  }, [assignedHospitalName, marks.hospitalChosen]);

  async function handleTriage() {
    setTriaging(true);
    setActionError(null);
    setAssignedDispatchId(null);
    setMarks({ ...NO_MARKS, call: Date.now() });

    try {
      const result = await runTriage(note);

      setTriage(result.triage);
      setSource(result.source);
      setSourceNote(result.note ?? null);
      setMarks((current) => ({ ...current, triaged: Date.now() }));

      await planFleet(result.triage, incident);
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
    setAssignedDispatchId(null);
    void planFleet(next, incident);
  }

  function moveIncident(point: LatLng) {
    setIncident(point);
    setAssignedDispatchId(null);
    if (triage) void planFleet(triage, point);
  }

  async function confirmAssign() {
    if (!triage || !assignedId) return;
    const candidate = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);
    if (!candidate) return;

    setActionError(null);
    setAssigning(true);
    try {
      const row = await assignAmbulance({
        ambulance_id: candidate.ambulance.id,
        patient_note: note,
        condition: triage.condition,
        severity: triage.severity,
        required_specialty: triage.requiredSpecialty,
        needs_icu: triage.needsICU,
        response_eta_minutes: Math.round(candidate.responseMinutes),
        incident_lat: incident.lat,
        incident_lng: incident.lng,
        input_mode: inputMode,
      });

      setAssignedDispatchId(row.id);
      setMarks((current) => ({ ...current, assigned: Date.now() }));
      toast({
        title: `${candidate.ambulance.callsign} assigned`,
        description: "Choosing a hospital is now on their tablet.",
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Assignment failed";
      setActionError(message);
      toast({ title: "Assignment failed", description: message, tone: "danger" });
    } finally {
      setAssigning(false);
    }
  }

  const candidate = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);
  const assignedCallsign = assignedDispatchId
    ? (candidate?.ambulance.callsign ??
      ambulances.find((a) => a.id === assignedDispatch?.ambulance_id)?.callsign ??
      null)
    : null;

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
      at: marks.assigned,
      detail: assignedCallsign
        ? `${assignedCallsign} · ${Math.round(candidate?.responseMinutes ?? 0)} min to scene`
        : null,
    },
    {
      label: "Hospital chosen by crew",
      at: marks.hospitalChosen,
      detail: assignedHospitalName ? `${assignedHospitalName}` : null,
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

      {/* ── Middle: the one decision — which ambulance ───────────────────── */}
      {fleetPick ? (
        <Section
          title="Assign an ambulance"
          description="Your only decision here. The crew picks the hospital once they're rolling."
        >
          {staleNotice ? (
            <div className="flex items-center gap-2 rounded-card border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
              <Radio className="size-4 shrink-0 text-accent" />
              Fleet status changed elsewhere — list updated.
            </div>
          ) : null}

          <AssignmentPanel
            candidate={candidate}
            planning={planning}
            assigning={assigning}
            onConfirm={confirmAssign}
            assignedCallsign={assignedCallsign}
            assignedHospitalName={assignedHospitalName}
          />

          {!assignedDispatchId ? (
            <AmbulanceList
              fleet={fleetPick}
              assignedId={assignedId}
              onAssign={setAssignedId}
            />
          ) : null}
        </Section>
      ) : null}

      {/* ── Bottom: the evidence ─────────────────────────────────────────── */}
      <Section
        title="Situation"
        description="Live view of the fleet, hospitals and the incident."
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
            recommendedId={null}
            selectedId={null}
            excludedIds={new Set()}
            onPickOrigin={moveIncident}
          />

          <IncidentTimeline steps={timeline} />
        </div>
      </Section>
    </div>
  );
}

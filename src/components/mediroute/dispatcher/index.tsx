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
import { assignAmbulance, getFleetPlan } from "@/lib/mediroute/backend";
import type { AmbulanceSelection, LatLng } from "@/lib/mediroute/types";
import { AmbulanceList } from "./ambulance-list";
import { AssignmentPanel } from "./assignment-panel";
import { IncidentTimeline, type TimelineStep } from "./incident-timeline";
import { IntakePanel } from "./intake-panel";
import { MapPanel } from "./map-panel";

const DEFAULT_INCIDENT: LatLng = { lat: 16.7769, lng: 96.1592 };

const EXAMPLE =
  "55M, crushing central chest pain radiating to left arm, diaphoretic, BP 90/60, GCS 14";

/** Timestamps for the timeline. Written in handlers or the poll-driven effect below, never during render. */
interface Marks {
  call: number | null;
  assigned: number | null;
  confirmed: number | null;
}

const NO_MARKS: Marks = { call: null, assigned: null, confirmed: null };

/**
 * The dispatch console.
 *
 * The dispatcher's job is exactly one thing: take the call, find the nearest
 * dispatchable ambulance, send it. No triage happens here —
 * selectAmbulance() ranks purely on incident location, so there was never a
 * real reason to ask the dispatcher for condition, severity or specialty.
 * That runs on the crew's own screen once they're assigned, along with the
 * hospital pick it feeds — see ambulance-dashboard.tsx. This component still
 * shows both landing (polling the same dispatch row it created), but never
 * offers to make either decision.
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

  const [fleetPick, setFleetPick] = useState<AmbulanceSelection | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [assignedDispatchId, setAssignedDispatchId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Marks>(NO_MARKS);

  const [actionError, setActionError] = useState<string | null>(null);

  const [mapMode, setMapMode] = useState<"google" | "svg">(
    googleMapsAvailable ? "google" : "svg",
  );

  const planFleet = useCallback(async (at: LatLng, silent = false) => {
    if (!silent) setPlanning(true);
    setActionError(null);
    try {
      const fleet = await getFleetPlan(at);
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

  // Live re-plan when fleet status changes elsewhere. Stops once assigned:
  // this incident's fleet decision is already made, so further fleet churn
  // from OTHER incidents is noise here.
  //
  // Debounced 1.2s for the same reason as the write side of any Routes call:
  // a burst of fleet events should coalesce into one re-plan.
  useEffect(() => {
    if (fleetRevision === 0 || !fleetPick || assignedDispatchId) return;
    // Reacting to an external realtime event (a change on another machine) —
    // the documented escape hatch for this rule. Once per event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleNotice(true);
    const planTimer = setTimeout(() => void planFleet(incident, true), 1200);
    const noticeTimer = setTimeout(() => setStaleNotice(false), 4000);
    return () => {
      clearTimeout(planTimer);
      clearTimeout(noticeTimer);
    };
    // fleetPick is read only as an existence check ("has a plan run yet");
    // including it would re-run this effect on every re-plan it itself causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetRevision, incident, assignedDispatchId, planFleet]);

  // Once assigned, watch the same dispatch row for the crew's confirmation
  // landing (polled via useDispatches) — the dispatcher can see the triage
  // and hospital choice happen without ever being offered to make either.
  const assignedDispatch = assignedDispatchId
    ? (dispatches.find((d) => d.id === assignedDispatchId) ?? null)
    : null;
  const assignedHospitalName = assignedDispatch?.hospital_id
    ? hospitals.find((h) => h.id === assignedDispatch.hospital_id)?.short_name
    : null;

  useEffect(() => {
    if (assignedHospitalName && marks.confirmed === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarks((current) => ({ ...current, confirmed: Date.now() }));
    }
  }, [assignedHospitalName, marks.confirmed]);

  async function handleFindAmbulances() {
    setActionError(null);
    setAssignedDispatchId(null);
    setMarks({ ...NO_MARKS, call: Date.now() });
    await planFleet(incident);
  }

  function moveIncident(point: LatLng) {
    setIncident(point);
    setAssignedDispatchId(null);
    if (fleetPick) void planFleet(point);
  }

  async function confirmAssign() {
    if (!assignedId) return;
    const candidate = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);
    if (!candidate) return;

    setActionError(null);
    setAssigning(true);
    try {
      const row = await assignAmbulance({
        ambulance_id: candidate.ambulance.id,
        patient_note: note,
        response_eta_minutes: Math.round(candidate.responseMinutes),
        incident_lat: incident.lat,
        incident_lng: incident.lng,
        input_mode: inputMode,
      });

      setAssignedDispatchId(row.id);
      setMarks((current) => ({ ...current, assigned: Date.now() }));
      toast({
        title: `${candidate.ambulance.callsign} assigned`,
        description: "Triage and hospital choice are now on their tablet.",
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
      label: "Ambulance assigned",
      at: marks.assigned,
      detail: assignedCallsign
        ? `${assignedCallsign} · ${Math.round(candidate?.responseMinutes ?? 0)} min to scene`
        : null,
    },
    {
      label: "Triaged & hospital confirmed by crew",
      at: marks.confirmed,
      detail:
        assignedDispatch?.hospital_id && assignedHospitalName
          ? `${assignedDispatch.severity} ${assignedDispatch.condition} → ${assignedHospitalName}`
          : null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {error ? <ErrorState message={error} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      {/* ── Top: the call ────────────────────────────────────────────────── */}
      <Section
        title="Emergency intake"
        description="What the caller reported — enough to find and send the nearest vehicle."
      >
        <IntakePanel
          note={note}
          onNoteChange={setNote}
          onModeChange={setInputMode}
          onFindAmbulances={handleFindAmbulances}
          finding={planning}
        />
      </Section>

      {/* ── Middle: the one decision — which ambulance ───────────────────── */}
      {fleetPick ? (
        <Section
          title="Assign an ambulance"
          description="Your only decision here. Triage and the hospital pick happen on the crew's tablet."
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { ErrorState } from "@/components/ui/states";
import { Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { googleMapsAvailable } from "@/components/mediroute/google-map";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateApiError } from "@/lib/i18n/translate-error";
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
  const t = useT();
  const { locale } = useLocale();
  const { hospitals, loading, error, live } = useHospitals();
  const { ambulances, revision: fleetRevision } = useFleet();
  const { dispatches } = useDispatches();
  const toast = useToast();

  const [incident, setIncident] = useState<LatLng>(DEFAULT_INCIDENT);

  const [note, setNote] = useState("");

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
      setActionError(
        cause instanceof Error
          ? translateApiError(cause.message, t, locale)
          : t("dispatcher.planningFailed"),
      );
    } finally {
      setPlanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

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
        input_mode: "text",
      });

      setAssignedDispatchId(row.id);
      setMarks((current) => ({ ...current, assigned: Date.now() }));
      toast({
        title: t("dispatcher.assignedToastTitle", { callsign: candidate.ambulance.callsign }),
        description: t("dispatcher.assignedToastDesc"),
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? translateApiError(cause.message, t, locale)
          : t("dispatcher.assignmentFailed");
      setActionError(message);
      toast({ title: t("dispatcher.assignmentFailed"), description: message, tone: "danger" });
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
      label: t("dispatcher.timelineCallReceived"),
      at: marks.call,
      detail: marks.call
        ? note.trim()
          ? note.slice(0, 80)
          : t("dispatcher.noNoteLocationOnly")
        : t("dispatcher.waitingForCall"),
    },
    {
      label: t("dispatcher.timelineAssigned"),
      at: marks.assigned,
      detail: assignedCallsign
        ? t("dispatcher.minToScene", {
            callsign: assignedCallsign,
            count: Math.round(candidate?.responseMinutes ?? 0),
          })
        : null,
    },
    {
      label: t("dispatcher.timelineConfirmed"),
      at: marks.confirmed,
      detail:
        assignedDispatch?.hospital_id && assignedHospitalName
          ? t("dispatcher.confirmedDetail", {
              severity: t(`status.severity.${assignedDispatch.severity}`),
              condition: t(`status.condition.${assignedDispatch.condition}`),
              hospital: assignedHospitalName,
            })
          : null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {error ? <ErrorState message={error} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      {/* ── Top: the call ────────────────────────────────────────────────── */}
      <Section
        title={t("dispatcher.sectionIntakeTitle")}
        description={t("dispatcher.sectionIntakeDesc")}
      >
        <IntakePanel
          note={note}
          onNoteChange={setNote}
          onFindAmbulances={handleFindAmbulances}
          finding={planning}
        />
      </Section>

      {/* ── Middle: the one decision — which ambulance ───────────────────── */}
      {fleetPick ? (
        <Section
          title={t("dispatcher.sectionAssignTitle")}
          description={t("dispatcher.sectionAssignDesc")}
        >
          {staleNotice ? (
            <div className="flex items-center gap-2 rounded-card border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
              <Radio className="size-4 shrink-0 text-accent" />
              {t("dispatcher.staleNoticeText")}
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
        title={t("dispatcher.sectionSituationTitle")}
        description={t("dispatcher.sectionSituationDesc")}
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

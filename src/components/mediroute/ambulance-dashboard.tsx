"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ambulance as AmbulanceIcon,
  Check,
  Hospital as HospitalIcon,
  MapPin,
  Route as RouteIcon,
  ShieldOff,
  Sparkles,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  AmbulanceStatusBadge,
  SeverityBadge,
  ambulanceStatusLabel,
  crewStages,
} from "@/components/mediroute/status";
import { HospitalChoiceList } from "@/components/mediroute/hospital-choice-list";
import { ReasonList } from "@/components/mediroute/reasons";
import { AmbulanceRouteMap } from "@/components/mediroute/ambulance-route-map";
import { TriageSummary, type TriageSource } from "@/components/mediroute/triage-summary";
import { VoiceInput } from "@/components/mediroute/voice-input";
import { confirmMission, getHospitalPlan, runTriage } from "@/lib/mediroute/backend";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { useDispatches } from "@/lib/mediroute/use-dispatches";
import {
  specialtyFor,
  type AmbulanceStatus,
  type Condition,
  type Recommendation,
  type Severity,
  type Triage,
} from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

const VEHICLE_KEY = "mediroute:vehicle";

/**
 * The in-cab screen. Read at arm's length on a tablet, often one-handed, so
 * everything here is deliberately larger than the rest of the app and the
 * controls are full-height targets rather than dense rows.
 *
 * There is no sign-in yet, so the crew picks its own vehicle once and the
 * choice is remembered on the device — the seam where auth will slot in.
 *
 * Picks up where the dispatcher leaves off: dispatch assigns a vehicle from
 * nothing but the incident location and stops there, so a fresh mission
 * always arrives with placeholder triage and hospital_id null. This screen
 * runs the actual triage (the same AI call the dispatcher used to run, just
 * relocated — selectAmbulance() never needed it), ranks hospitals against
 * it, and only once the crew confirms does the mission look "complete" to
 * the rest of the app (History, the dispatcher's timeline).
 */
export function AmbulanceDashboard() {
  const { ambulances, loading, error, reload } = useFleet();
  const { hospitals } = useHospitals();
  const { dispatches, reload: reloadDispatches } = useDispatches();
  const toast = useToast();

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  /** The crew's own description — seeded from the dispatcher's optional note, editable. */
  const [crewNote, setCrewNote] = useState("");

  const [triage, setTriage] = useState<Triage | null>(null);
  const [triageSource, setTriageSource] = useState<TriageSource>(null);
  const [triageSourceNote, setTriageSourceNote] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);

  const [hospitalPlan, setHospitalPlan] = useState<Recommendation | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [pickedHospitalId, setPickedHospitalId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const missionIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/triage")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r?.data?.aiAvailable ?? false))
      .catch(() => setAiAvailable(false));
  }, []);

  // Restore the last vehicle after mount — localStorage isn't readable during
  // render without breaking hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVehicleId(localStorage.getItem(VEHICLE_KEY));
  }, []);

  const vehicle = useMemo(
    () => ambulances.find((a) => a.id === vehicleId) ?? ambulances[0] ?? null,
    [ambulances, vehicleId],
  );

  /** The newest run assigned to this vehicle. Older ones are history. */
  const mission = useMemo(
    () =>
      vehicle ? (dispatches.find((d) => d.ambulance_id === vehicle.id) ?? null) : null,
    [dispatches, vehicle],
  );

  const destination = useMemo(
    () =>
      mission?.hospital_id
        ? (hospitals.find((h) => h.id === mission.hospital_id) ?? null)
        : null,
    [hospitals, mission],
  );

  // A genuinely new mission (new incident, or the crew switched vehicles) —
  // clear any in-progress local triage/hospital draft from the previous one.
  // Doesn't fire on the dispatch feed's own 10s poll ticks, only when the
  // mission actually changes, so a half-finished triage isn't wiped out from
  // under the crew while they're still working on it.
  useEffect(() => {
    if (mission?.id !== missionIdRef.current) {
      missionIdRef.current = mission?.id ?? null;
      setCrewNote(mission?.patient_note ?? "");
      setTriage(null);
      setTriageSource(null);
      setTriageSourceNote(null);
      setHospitalPlan(null);
      setPickedHospitalId(null);
    }
  }, [mission?.id, mission?.patient_note]);

  /** Triage already on the mission if confirmed, otherwise the crew's own draft. */
  const knownTriage = triage ??
    (mission?.hospital_id
      ? {
          condition: mission.condition as Condition,
          severity: mission.severity as Severity,
          requiredSpecialty: mission.required_specialty,
          needsICU: mission.needs_icu,
        }
      : null);

  // The road leg to draw right now, given where the vehicle is in its run.
  const currentLeg = useMemo(() => {
    if (!vehicle || !mission || mission.incident_lat == null || mission.incident_lng == null) {
      return null;
    }
    const scene = { lat: mission.incident_lat, lng: mission.incident_lng };

    if (vehicle.status === "dispatched") {
      if (vehicle.lat == null || vehicle.lng == null) return null;
      return {
        origin: { lat: vehicle.lat, lng: vehicle.lng },
        destination: scene,
        originLabel: vehicle.callsign,
        destinationLabel: "Scene",
        legColor: "warning" as const,
      };
    }

    if (vehicle.status === "on_scene" || vehicle.status === "transporting") {
      if (!destination) return null;
      return {
        origin: scene,
        destination: { lat: destination.lat, lng: destination.lng },
        originLabel: "Scene",
        destinationLabel: destination.short_name,
        legColor: "accent" as const,
      };
    }

    return null;
  }, [vehicle, mission, destination]);

  function chooseVehicle(id: string) {
    setVehicleId(id);
    localStorage.setItem(VEHICLE_KEY, id);
  }

  async function advance(status: AmbulanceStatus, label: string) {
    if (!vehicle) return;
    setBusy(true);
    setWriteError(null);
    try {
      const response = await fetch(`/api/ambulances/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);

      await reload();
      toast({ title: `${vehicle.callsign} — ${label}` });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Update failed";
      setWriteError(message);
      toast({ title: "Could not update status", description: message, tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function rankHospitals(t: Triage) {
    if (!mission || mission.incident_lat == null || mission.incident_lng == null) return;
    setPlanLoading(true);
    setWriteError(null);
    try {
      const rec = await getHospitalPlan(t, {
        lat: mission.incident_lat,
        lng: mission.incident_lng,
      });
      setHospitalPlan(rec);
      setPickedHospitalId(rec.ranked[0]?.hospital.id ?? null);
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : "Could not rank hospitals");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleRunTriage() {
    if (!mission || crewNote.trim().length < 3) return;
    setTriaging(true);
    setWriteError(null);
    try {
      const result = await runTriage(crewNote);
      setTriage(result.triage);
      setTriageSource(result.source);
      setTriageSourceNote(result.note ?? null);
      await rankHospitals(result.triage);
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : "Triage failed");
    } finally {
      setTriaging(false);
    }
  }

  function patchTriage(patch: Partial<Triage>) {
    if (!triage) return;
    const next: Triage = { ...triage, ...patch };
    if (patch.condition) next.requiredSpecialty = specialtyFor[patch.condition];
    setTriage(next);
    setTriageSource("manual");
    setTriageSourceNote(null);
    void rankHospitals(next);
  }

  async function handleConfirm() {
    if (!mission || !triage || !hospitalPlan || !pickedHospitalId) return;
    const chosen = hospitalPlan.ranked.find((r) => r.hospital.id === pickedHospitalId);
    if (!chosen) return;

    setConfirming(true);
    setWriteError(null);
    try {
      await confirmMission({
        dispatch_id: mission.id,
        patient_note: crewNote,
        condition: triage.condition,
        severity: triage.severity,
        required_specialty: triage.requiredSpecialty,
        needs_icu: triage.needsICU,
        hospital_id: chosen.hospital.id,
        recommended_hospital_id: hospitalPlan.ranked[0]?.hospital.id ?? null,
        eta_minutes: Math.round(chosen.etaMinutes),
      });
      await reloadDispatches();
      toast({
        title: `Routing to ${chosen.hospital.short_name}`,
        description: `${Math.round(chosen.etaMinutes)} min transport.`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not confirm";
      setWriteError(message);
      toast({ title: "Could not confirm", description: message, tone: "danger" });
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Skeleton rows={4} />;
  if (error) return <ErrorState message={error} />;

  if (!vehicle) {
    return (
      <EmptyState
        icon={<AmbulanceIcon className="size-6" />}
        title="No vehicles in the fleet"
        body="Add an ambulance on the fleet ops screen to get started."
      />
    );
  }

  const currentStageIndex = crewStages.findIndex((s) => s.status === vehicle.status);
  const pickedEntry = hospitalPlan?.ranked.find((r) => r.hospital.id === pickedHospitalId);
  const needsTriage = Boolean(mission && !mission.hospital_id && !triage);
  const needsHospitalPick = Boolean(mission && !mission.hospital_id && triage);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Who am I ─────────────────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold tracking-tight">
                {vehicle.callsign}
              </span>
              <AmbulanceStatusBadge status={vehicle.status} />
              {!vehicle.certified ? (
                <Badge tone="danger">
                  <ShieldOff className="size-3" />
                  Uncertified
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted">
              {vehicle.operator} · {vehicle.crew_level} crew
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">This vehicle</span>
            <Select
              value={vehicle.id}
              onChange={(event) => chooseVehicle(event.target.value)}
              aria-label="Select your vehicle"
              className="h-11 min-w-40 text-base"
            >
              {ambulances.map((a) => (
                <option key={a.id} value={a.id}>{a.callsign}</option>
              ))}
            </Select>
          </label>
        </CardBody>
      </Card>

      {writeError ? <ErrorState message={writeError} /> : null}

      {!vehicle.certified ? (
        <div className="flex items-start gap-2 rounded-card border border-danger/50 bg-danger/12 px-4 py-3">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="text-sm text-danger">
            <strong>This vehicle is not certified.</strong> Without a fitted IoT
            unit reporting GPS it will never be assigned a run, however close it
            is to an incident.
          </span>
        </div>
      ) : null}

      {/* ── The run ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current mission</CardTitle>
          <CardDescription>
            {mission
              ? "Assigned by dispatch. Run triage yourself, then pick where you're taking the patient."
              : "Nothing assigned right now."}
          </CardDescription>
        </CardHeader>

        <CardBody>
          {!mission ? (
            <EmptyState
              icon={<AmbulanceIcon className="size-6" />}
              title="Standing by"
              body="You'll see the patient, the destination and the route here the moment dispatch assigns this vehicle."
            />
          ) : (
            <div className="flex flex-col gap-5">
              {knownTriage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={knownTriage.severity} />
                  <Badge tone="neutral">{knownTriage.condition}</Badge>
                  {knownTriage.needsICU ? <Badge tone="danger">ICU on arrival</Badge> : null}
                  <Badge tone="neutral">needs {knownTriage.requiredSpecialty}</Badge>
                </div>
              ) : null}

              {mission.hospital_id ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Patient
                  </p>
                  <p className="text-lg leading-snug">
                    {mission.patient_note || "No description recorded"}
                  </p>
                </div>
              ) : null}

              {destination ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-card border border-border bg-surface-muted/50 p-4">
                    <MapPin className="mt-1 size-5 shrink-0 text-danger" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted">
                        Scene
                      </p>
                      <p className="text-lg font-medium">
                        {Math.round(mission.response_eta_minutes)} min out
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-card border border-border bg-surface-muted/50 p-4">
                    <HospitalIcon className="mt-1 size-5 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted">
                        Destination
                      </p>
                      <p className="text-lg font-medium">{destination.short_name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <Timer className="size-3" />
                        {Math.round(mission.eta_minutes)} min transport
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-card border border-border bg-surface-muted/50 p-4">
                  <MapPin className="mt-1 size-5 shrink-0 text-danger" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      Scene
                    </p>
                    <p className="text-lg font-medium">
                      {Math.round(mission.response_eta_minutes)} min out
                    </p>
                    <p className="text-xs text-muted">
                      {needsTriage ? "Run triage below" : "Choose the destination below"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Patient description + triage — the crew's own, not dispatch's ─── */}
      {needsTriage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patient description</CardTitle>
            <CardDescription>
              {mission?.patient_note
                ? "Dispatch's note is pre-filled below — extend it, then run triage."
                : "Dispatch sent no note. Describe the patient, then run triage."}
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <VoiceInput
              disabled={triaging}
              onListeningChange={(listening) => {
                if (listening) setCrewNote("");
              }}
              onTranscript={setCrewNote}
            />

            <Field label="Description" htmlFor="crew-note">
              <Textarea
                id="crew-note"
                value={crewNote}
                onChange={(event) => setCrewNote(event.target.value)}
                rows={4}
                placeholder="e.g. 30F, motorcycle collision, open tibia fracture, alert"
              />
            </Field>

            <Button
              onClick={handleRunTriage}
              disabled={triaging || crewNote.trim().length < 3}
              className="self-start"
            >
              {triaging ? <Spinner /> : <Sparkles className="size-4" />}
              {triaging ? "Triaging…" : "Run triage"}
            </Button>
            {aiAvailable === false ? (
              <p className="text-xs text-warning">
                No <code>ANTHROPIC_API_KEY</code> set — using the keyword fallback.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* ── Choose the hospital, once triage is in ───────────────────────── */}
      {needsHospitalPick && triage ? (
        <>
          <TriageSummary
            triage={triage}
            source={triageSource}
            sourceNote={triageSourceNote}
            onPatch={patchTriage}
          />

          <HospitalChoiceList
            rec={hospitalPlan}
            selectedId={pickedHospitalId}
            onSelect={setPickedHospitalId}
          />

          {planLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Ranking hospitals…
            </div>
          ) : null}

          {pickedEntry ? (
            <Card className="border-accent/40">
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle>Recommended because</CardTitle>
                  <CardDescription>
                    {pickedEntry.hospital.short_name} · confirming locks in the route
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                <ReasonList reasons={pickedEntry.reasons} />
                <Button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="self-start"
                >
                  <Check className="size-4" />
                  {confirming ? "Confirming…" : "Confirm hospital & route"}
                </Button>
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}

      {/* ── The road, once there's a leg to show ─────────────────────────── */}
      {currentLeg ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RouteIcon className="size-4" />
              Route
            </CardTitle>
            <CardDescription>
              {currentLeg.originLabel} → {currentLeg.destinationLabel}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <AmbulanceRouteMap
              origin={currentLeg.origin}
              destination={currentLeg.destination}
              originLabel={currentLeg.originLabel}
              destinationLabel={currentLeg.destinationLabel}
              legColor={currentLeg.legColor}
            />
          </CardBody>
        </Card>
      ) : null}

      {/* ── Status ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update status</CardTitle>
          <CardDescription>
            Currently <strong>{ambulanceStatusLabel[vehicle.status]}</strong>.
            Dispatch sees this immediately.
          </CardDescription>
        </CardHeader>

        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {crewStages.map((stage, index) => {
            const isCurrent = vehicle.status === stage.status;
            const isPast = currentStageIndex > index && currentStageIndex !== -1;

            return (
              <button
                key={stage.action}
                onClick={() => advance(stage.status, stage.done)}
                disabled={busy || isCurrent}
                className={cn(
                  "flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border p-4",
                  "text-center text-base font-medium transition-colors",
                  "disabled:pointer-events-none",
                  isCurrent
                    ? "border-accent bg-accent-soft text-accent"
                    : isPast
                      ? "border-border bg-surface-muted/50 text-muted hover:border-accent/40"
                      : "border-border bg-surface hover:border-accent/60 hover:bg-accent-soft/50",
                )}
              >
                <span className="text-xs font-normal text-muted">
                  Step {index + 1}
                </span>
                <span className="text-lg">{isCurrent ? stage.done : stage.action}</span>
                {isCurrent ? (
                  <span className="text-xs font-normal">Current status</span>
                ) : null}
              </button>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ambulance as AmbulanceIcon,
  Hospital as HospitalIcon,
  MapPin,
  ShieldOff,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  AmbulanceStatusBadge,
  SeverityBadge,
  ambulanceStatusLabel,
  crewStages,
} from "@/components/mediroute/status";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { useDispatches } from "@/lib/mediroute/use-dispatches";
import type { AmbulanceStatus } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

const VEHICLE_KEY = "mediroute:vehicle";

/**
 * The in-cab screen. Read at arm's length on a tablet, often one-handed, so
 * everything here is deliberately larger than the rest of the app and the
 * controls are full-height targets rather than dense rows.
 *
 * There is no sign-in yet, so the crew picks its own vehicle once and the
 * choice is remembered on the device — the seam where auth will slot in.
 */
export function AmbulanceDashboard() {
  const { ambulances, loading, error, reload } = useFleet();
  const { hospitals } = useHospitals();
  const { dispatches } = useDispatches();
  const toast = useToast();

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

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
      vehicle ? dispatches.find((d) => d.ambulance_id === vehicle.id) ?? null : null,
    [dispatches, vehicle],
  );

  const destination = useMemo(
    () =>
      mission?.hospital_id
        ? hospitals.find((h) => h.id === mission.hospital_id) ?? null
        : null,
    [hospitals, mission],
  );

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
              ? "Assigned by dispatch. Patient details as reported on the 119 call."
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
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={mission.severity} />
                <Badge tone="neutral">{mission.condition}</Badge>
                {mission.needs_icu ? <Badge tone="danger">ICU on arrival</Badge> : null}
                <Badge tone="neutral">needs {mission.required_specialty}</Badge>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Patient
                </p>
                <p className="text-lg leading-snug">
                  {mission.patient_note || "No description recorded"}
                </p>
              </div>

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
                    {mission.incident_lat != null && mission.incident_lng != null ? (
                      <p className="font-mono text-xs text-muted">
                        {mission.incident_lat.toFixed(4)},{" "}
                        {mission.incident_lng.toFixed(4)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-card border border-border bg-surface-muted/50 p-4">
                  <HospitalIcon className="mt-1 size-5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                      Destination
                    </p>
                    <p className="text-lg font-medium">
                      {destination?.short_name ?? "Hospital not found"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Timer className="size-3" />
                      {Math.round(mission.eta_minutes)} min transport
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

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

"use client";

import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  ArrowRight,
  Check,
  Hospital as HospitalIcon,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/states";
import type { AmbulanceCandidate, Ranked } from "@/lib/mediroute/types";
import { ReasonList } from "./reasons";

/**
 * The decision, stated in one place: which vehicle, which hospital, and why.
 *
 * Deliberately shows no scores or weights. The engine's own `reasons` are
 * plain language already, and a dispatcher choosing between two hospitals is
 * served by "no cardiologist on duty", not by 0.732 vs 0.688.
 */
export function Recommendation({
  assigned,
  chosen,
  isTopHospital,
  ranking,
  relaxed,
  onConfirm,
  dispatched,
}: {
  assigned: AmbulanceCandidate | undefined;
  chosen: Ranked | undefined;
  isTopHospital: boolean;
  ranking: boolean;
  relaxed: boolean;
  onConfirm: () => void;
  dispatched: boolean;
}) {
  const response = Math.round(assigned?.responseMinutes ?? 0);
  const transport = Math.round(chosen?.etaMinutes ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {relaxed ? (
        <div className="flex items-start gap-2 rounded-card border border-danger/50 bg-danger/12 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-danger" />
          <span className="text-danger">
            <strong>No fully-equipped hospital available.</strong>{" "}
            Critical-severity requirements were relaxed to return any option —
            verify before dispatching.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Vehicle ──────────────────────────────────────────────────── */}
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <AmbulanceIcon className="size-4 text-warning" />
                Recommended ambulance
              </CardTitle>
              <CardDescription>Nearest certified vehicle on the road</CardDescription>
            </div>
            {ranking ? <Spinner /> : null}
          </CardHeader>

          <CardBody>
            {assigned ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-semibold tracking-tight">
                    {assigned.ambulance.callsign}
                  </span>
                  <Badge tone="neutral">{assigned.ambulance.crew_level} crew</Badge>
                  <span className="text-sm text-muted">
                    {assigned.ambulance.operator}
                  </span>
                </div>

                <ReasonList
                  reasons={[
                    `${response} min to reach the patient`,
                    `${assigned.distanceKm.toFixed(1)} km from the incident`,
                    "Certified, with a live GPS fix",
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm text-danger">
                No dispatchable ambulance. Escalate manually.
              </p>
            )}
          </CardBody>
        </Card>

        {/* ── Hospital ─────────────────────────────────────────────────── */}
        <Card className="border-accent/40">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <HospitalIcon className="size-4 text-accent" />
                {isTopHospital ? "Recommended hospital" : "Your chosen hospital"}
              </CardTitle>
              <CardDescription>
                {isTopHospital
                  ? "Best match on capacity and travel time"
                  : "Overrides the system recommendation"}
              </CardDescription>
            </div>
            {ranking ? <Spinner /> : null}
          </CardHeader>

          <CardBody>
            {chosen ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-semibold tracking-tight">
                    {chosen.hospital.short_name}
                  </span>
                  {isTopHospital ? (
                    <Badge tone="accent">Recommended</Badge>
                  ) : (
                    <Badge tone="warning">Dispatcher override</Badge>
                  )}
                </div>

                <p className="text-sm font-medium text-muted">Recommended because</p>
                <ReasonList reasons={chosen.reasons} />
              </div>
            ) : (
              <p className="text-sm text-danger">
                No hospital can take this patient. Escalate manually.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Total time + the one irreversible action ───────────────────── */}
      {chosen ? (
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Timer className="size-4 shrink-0 text-muted" />
              <span className="font-medium">
                {response + transport} min to definitive care
              </span>
              <span className="text-muted">
                — {response} min to the scene
                <ArrowRight className="mx-1 inline size-3" />
                {transport} min to {chosen.hospital.short_name}
              </span>
            </div>

            <Button
              onClick={onConfirm}
              disabled={!assigned || dispatched}
              className="shrink-0"
            >
              <Check className="size-4" />
              {dispatched
                ? "Dispatched"
                : !assigned
                  ? "Assign an ambulance first"
                  : isTopHospital
                    ? "Confirm dispatch"
                    : "Dispatch override"}
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

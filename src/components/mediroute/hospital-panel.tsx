"use client";

import { useState } from "react";
import { Activity, BedDouble, HeartPulse, Minus, Plus, Radio, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { hospitalStatus } from "@/components/mediroute/status";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import type { Hospital } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/** Mirrors the PATCH body accepted by /api/hospitals/[id]. Declared here so
 *  this client component never imports the server-only store module. */
type CapacityPatch = Partial<
  Pick<Hospital, "available_beds" | "icu_beds_free" | "current_er_queue" | "doctors_on_duty">
>;

/**
 * The hospital staff screen. Run it on a second machine during the demo —
 * alt-tabbing to change your own data in front of judges undercuts the whole
 * illusion that this is live inter-hospital state.
 *
 * Every hospital is listed rather than just "yours": there is no sign-in yet,
 * and being able to change any of them is what makes the live re-ranking
 * demonstrable from one room.
 */
export function HospitalPanel() {
  const { hospitals, loading, error, live, reload } = useHospitals();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const toast = useToast();

  async function patch(hospital: Hospital, body: CapacityPatch, label: string) {
    setBusyId(hospital.id);
    setWriteError(null);
    try {
      const response = await fetch(`/api/hospitals/${hospital.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);

      await reload();
      toast({
        title: `${hospital.short_name} updated`,
        description: `${label}. Dispatch re-ranks immediately.`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Update failed";
      setWriteError(message);
      toast({ title: "Could not update", description: message, tone: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Skeleton rows={4} />;
  if (error) return <ErrorState message={error} />;

  const bedsFree = hospitals.reduce((sum, h) => sum + h.available_beds, 0);
  const icuFree = hospitals.reduce((sum, h) => sum + h.icu_beds_free, 0);
  const diverting = hospitals.filter(
    (h) => hospitalStatus(h).label === "Diverting",
  ).length;
  const erLoad = hospitals.length
    ? Math.round(
        (hospitals.reduce(
          (sum, h) => sum + (h.er_capacity ? h.current_er_queue / h.er_capacity : 0),
          0,
        ) /
          hospitals.length) *
          100,
      )
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <Stat
          label="Beds free"
          value={bedsFree}
          sub={`across ${hospitals.length} hospitals`}
          tone={bedsFree === 0 ? "danger" : "neutral"}
          icon={<BedDouble className="size-3.5" />}
        />
        <Stat
          label="ICU beds free"
          value={icuFree}
          tone={icuFree === 0 ? "danger" : "neutral"}
          icon={<HeartPulse className="size-3.5" />}
        />
        <Stat
          label="Average ER load"
          value={`${erLoad}%`}
          tone={erLoad >= 75 ? "warning" : "neutral"}
          icon={<Activity className="size-3.5" />}
        />
        <Stat
          label="Diverting"
          value={diverting}
          sub="cannot accept new patients"
          tone={diverting > 0 ? "danger" : "success"}
        />
      </StatGrid>

      <div className="flex items-center gap-2">
        <Badge tone={live ? "success" : "neutral"}>
          <Radio className="size-3" />
          {live ? "Broadcasting live" : "Polling mode"}
        </Badge>
        <p className="text-sm text-muted">
          Changes here re-rank the dispatcher&apos;s recommendation instantly.
        </p>
      </div>

      {writeError ? <ErrorState message={writeError} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {hospitals.map((hospital) => {
          const erPercent = hospital.er_capacity
            ? Math.round((hospital.current_er_queue / hospital.er_capacity) * 100)
            : 0;
          const busy = busyId === hospital.id;
          const status = hospitalStatus(hospital);

          return (
            <Card
              key={hospital.id}
              className={cn("transition-opacity", busy && "opacity-60")}
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle>{hospital.name}</CardTitle>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <CardDescription>{status.detail}</CardDescription>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {hospital.specialties.map((specialty) => (
                    <Badge key={specialty} tone="neutral">{specialty}</Badge>
                  ))}
                </div>
              </CardHeader>

              <CardBody className="flex flex-col gap-4">
                <Stepper
                  icon={<BedDouble className="size-4" />}
                  label="Available beds"
                  value={hospital.available_beds}
                  suffix={`/ ${hospital.total_beds}`}
                  tone={hospital.available_beds === 0 ? "danger" : "normal"}
                  disabled={busy}
                  onChange={(value) =>
                    patch(hospital, { available_beds: value }, `${value} beds free`)
                  }
                />

                <Stepper
                  icon={<HeartPulse className="size-4" />}
                  label="ICU beds free"
                  value={hospital.icu_beds_free}
                  tone={hospital.icu_beds_free === 0 ? "danger" : "normal"}
                  disabled={busy}
                  onChange={(value) =>
                    patch(hospital, { icu_beds_free: value }, `${value} ICU beds free`)
                  }
                />

                <Stepper
                  icon={<Users className="size-4" />}
                  label="ER queue"
                  value={hospital.current_er_queue}
                  suffix={`/ ${hospital.er_capacity} · ${erPercent}%`}
                  tone={erPercent >= 100 ? "danger" : erPercent >= 75 ? "warning" : "normal"}
                  disabled={busy}
                  onChange={(value) =>
                    patch(hospital, { current_er_queue: value }, `ER queue at ${value}`)
                  }
                />

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Specialists on duty
                  </p>
                  {Object.entries(hospital.doctors_on_duty).map(([specialty, count]) => (
                    <Stepper
                      key={specialty}
                      label={specialty}
                      value={count}
                      small
                      tone={count === 0 ? "danger" : "normal"}
                      disabled={busy}
                      onChange={(value) =>
                        patch(
                          hospital,
                          {
                            doctors_on_duty: {
                              ...hospital.doctors_on_duty,
                              [specialty]: value,
                            },
                          },
                          `${value} ${specialty} on duty`,
                        )
                      }
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  icon,
  label,
  value,
  suffix,
  tone = "normal",
  small,
  disabled,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone?: "normal" | "warning" | "danger";
  small?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <span className={cn("truncate", small ? "text-sm" : "text-sm font-medium")}>
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${label}`}
          className="grid size-7 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
        >
          <Minus className="size-3.5" />
        </button>

        <span
          className={cn(
            "min-w-14 text-right font-mono text-sm tabular-nums",
            tone === "danger" && "text-danger",
            tone === "warning" && "text-warning",
          )}
        >
          {value}
          {suffix ? <span className="text-xs text-muted"> {suffix}</span> : null}
        </span>

        <button
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          aria-label={`Increase ${label}`}
          className="grid size-7 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

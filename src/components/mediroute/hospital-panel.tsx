"use client";

import { useState } from "react";
import { BedDouble, Minus, Plus, Radio, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import type { Hospital } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/** Mirrors the PATCH body accepted by /api/hospitals/[id]. Declared here so
 *  this client component never imports the server-only store module. */
type CapacityPatch = Partial<
  Pick<Hospital, "available_beds" | "icu_beds_free" | "current_er_queue" | "doctors_on_duty">
>;

/**
 * The "hospital staff" screen. Run this on a second machine during the demo —
 * alt-tabbing to change your own data in front of judges undercuts the whole
 * illusion that this is live inter-hospital state.
 */
export function HospitalPanel() {
  const { hospitals, loading, error, live, reload } = useHospitals();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  async function patch(hospital: Hospital, body: CapacityPatch) {
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
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Skeleton rows={4} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="flex flex-col gap-4">
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

          return (
            <Card key={hospital.id} className={cn(busy && "opacity-60")}>
              <CardHeader>
                <CardTitle>{hospital.name}</CardTitle>
                <CardDescription className="flex flex-wrap gap-1.5">
                  {hospital.specialties.map((s) => (
                    <Badge key={s} tone="neutral">{s}</Badge>
                  ))}
                </CardDescription>
              </CardHeader>

              <CardBody className="flex flex-col gap-4">
                <Stepper
                  icon={<BedDouble className="size-4" />}
                  label="Available beds"
                  value={hospital.available_beds}
                  suffix={`/ ${hospital.total_beds}`}
                  tone={hospital.available_beds === 0 ? "danger" : "normal"}
                  disabled={busy}
                  onChange={(v) => patch(hospital, { available_beds: v })}
                />

                <Stepper
                  icon={<BedDouble className="size-4" />}
                  label="ICU beds free"
                  value={hospital.icu_beds_free}
                  tone={hospital.icu_beds_free === 0 ? "danger" : "normal"}
                  disabled={busy}
                  onChange={(v) => patch(hospital, { icu_beds_free: v })}
                />

                <Stepper
                  icon={<Users className="size-4" />}
                  label="ER queue"
                  value={hospital.current_er_queue}
                  suffix={`/ ${hospital.er_capacity} · ${erPercent}%`}
                  tone={erPercent >= 100 ? "danger" : erPercent >= 75 ? "warning" : "normal"}
                  disabled={busy}
                  onChange={(v) => patch(hospital, { current_er_queue: v })}
                />

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted">Specialists on duty</p>
                  {Object.entries(hospital.doctors_on_duty).map(([specialty, count]) => (
                    <Stepper
                      key={specialty}
                      label={specialty}
                      value={count}
                      small
                      tone={count === 0 ? "danger" : "normal"}
                      disabled={busy}
                      onChange={(v) =>
                        patch(hospital, {
                          doctors_on_duty: { ...hospital.doctors_on_duty, [specialty]: v },
                        })
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

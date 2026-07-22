"use client";

import { Ban, Hospital as HospitalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Recommendation } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/**
 * The crew's hospital pick. This is the whole decision now — the dispatcher's
 * job ends at assigning a vehicle, so there's no fallback recommendation
 * sitting behind this one on another screen.
 *
 * Facts only per row: beds, ICU, the specialist this patient needs, ER load.
 * The composite score and its weights are deliberately not shown; they are an
 * implementation detail of the ranking. Once a row is selected, the caller
 * shows the full reasons (ReasonList) in a separate confirmation card — this
 * list is for comparing, not for the final justification.
 */
export function HospitalChoiceList({
  rec,
  selectedId,
  onSelect,
}: {
  rec: Recommendation | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HospitalIcon className="size-4" />
          Choose the destination
        </CardTitle>
        <CardDescription>
          {rec
            ? `${rec.ranked.length} can take this patient · ${rec.excluded.length} filtered out`
            : "Loading eligible hospitals…"}
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-2">
        {!rec ? (
          <EmptyState
            icon={<HospitalIcon className="size-6" />}
            title="Ranking hospitals…"
            body="This appears as soon as the plan loads."
          />
        ) : rec.ranked.length === 0 ? (
          <p className="text-sm text-danger">
            No hospital can take this patient. Escalate to dispatch.
          </p>
        ) : (
          rec.ranked.map((entry, index) => {
            const isSelected = entry.hospital.id === selectedId;
            const specialists =
              entry.hospital.doctors_on_duty[rec.triage.requiredSpecialty] ?? 0;
            const erPercent = entry.hospital.er_capacity
              ? Math.round(
                  (entry.hospital.current_er_queue / entry.hospital.er_capacity) * 100,
                )
              : 0;

            return (
              <button
                key={entry.hospital.id}
                onClick={() => onSelect(entry.hospital.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col gap-1.5 rounded-card border p-4 text-left transition-colors",
                  isSelected
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface-muted/50 hover:border-accent/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-medium">{entry.hospital.short_name}</span>
                  {index === 0 ? <Badge tone="accent">Recommended</Badge> : null}
                  {isSelected && index !== 0 ? (
                    <Badge tone="warning">Your choice</Badge>
                  ) : null}
                  <span className="ml-auto text-base font-medium tabular-nums">
                    {Math.round(entry.etaMinutes)} min
                  </span>
                </div>

                <p className="text-sm text-muted">
                  {entry.hospital.available_beds} beds ·{" "}
                  {entry.hospital.icu_beds_free} ICU ·{" "}
                  <span className={specialists === 0 ? "text-warning" : undefined}>
                    {specialists} {rec.triage.requiredSpecialty}
                  </span>{" "}
                  ·{" "}
                  <span className={erPercent >= 75 ? "text-warning" : undefined}>
                    ER {erPercent}%
                  </span>
                </p>
              </button>
            );
          })
        )}

        {rec?.excluded.length ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted">
              Cannot take this patient
            </p>
            {rec.excluded.map((entry) => (
              <div
                key={entry.hospital.id}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <Ban className="size-3.5 shrink-0" />
                <span className="font-medium">{entry.hospital.short_name}</span>
                <span className="text-xs">{Math.round(entry.etaMinutes)} min</span>
                <span className="ml-auto text-right text-xs text-danger">
                  {entry.reason}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

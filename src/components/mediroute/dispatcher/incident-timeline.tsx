"use client";

import { Check } from "lucide-react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  label: string;
  /** Filled in once the step happens. Absent means "not yet". */
  detail?: string | null;
  at?: number | null;
}

/**
 * The run as it happened, in order. Exists mostly for the demo: it makes the
 * thirty seconds between a call arriving and an ambulance rolling legible
 * after the fact, instead of the screen just quietly filling with results.
 *
 * Timestamps are captured in the dispatcher's own handlers, so nothing here
 * reads the clock during render.
 */
export function IncidentTimeline({ steps }: { steps: TimelineStep[] }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dispatcher.incidentTimelineTitle")}</CardTitle>
        <CardDescription>{t("dispatcher.incidentTimelineDesc")}</CardDescription>
      </CardHeader>

      <CardBody>
        <ol className="flex flex-col">
          {steps.map((step, index) => {
            const done = step.at != null;
            const last = index === steps.length - 1;

            return (
              <li key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                      done
                        ? "border-transparent bg-success text-white"
                        : "border-dashed border-border text-muted",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      <span className="text-[10px] font-medium">{index + 1}</span>
                    )}
                  </span>
                  {!last ? (
                    <span
                      className={cn(
                        "w-px flex-1 transition-colors",
                        done ? "bg-success/40" : "bg-border",
                      )}
                    />
                  ) : null}
                </div>

                <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        done ? "text-foreground" : "text-muted",
                      )}
                    >
                      {step.label}
                    </p>
                    {step.at != null ? (
                      <time className="font-mono text-xs text-muted">
                        {new Date(step.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    ) : null}
                  </div>
                  {step.detail ? (
                    <p className="text-sm text-muted">{step.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

"use client";

import { Ambulance as AmbulanceIcon, Ban, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateReason } from "@/lib/i18n/translate-reason";
import type { AmbulanceSelection } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/**
 * The dispatchable fleet, nearest first, with the vehicles that were ruled out
 * and why. The rejections matter as much as the candidates: the two vehicles
 * physically closest to the incident are often the two that cannot go.
 */
export function AmbulanceList({
  fleet,
  assignedId,
  onAssign,
}: {
  fleet: AmbulanceSelection | null;
  assignedId: string | null;
  onAssign: (id: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AmbulanceIcon className="size-4" />
          {t("dispatcher.ambulancesTitle")}
        </CardTitle>
        <CardDescription>
          {fleet
            ? t("dispatcher.dispatchableSummary", {
                candidates: fleet.candidates.length,
                rejected: fleet.rejected.length,
              })
            : t("dispatcher.listedOnceTriage")}
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-2">
        {!fleet ? (
          <EmptyState
            icon={<AmbulanceIcon className="size-6" />}
            title={t("dispatcher.noFleetPlanTitle")}
            body={t("dispatcher.noFleetPlanBody")}
          />
        ) : fleet.candidates.length === 0 ? (
          <p className="text-sm text-danger">{t("dispatcher.noDispatchable")}</p>
        ) : (
          fleet.candidates.map((candidate, index) => {
            const isAssigned = candidate.ambulance.id === assignedId;
            return (
              <button
                key={candidate.ambulance.id}
                onClick={() => onAssign(candidate.ambulance.id)}
                aria-pressed={isAssigned}
                className={cn(
                  "flex items-center gap-2.5 rounded-card border p-3.5 text-left transition-colors",
                  isAssigned
                    ? "border-warning bg-warning/12"
                    : "border-border bg-surface-muted/50 hover:border-warning/40",
                )}
              >
                <ShieldCheck className="size-4 shrink-0 text-success" />
                <span className="font-medium">{candidate.ambulance.callsign}</span>
                <Badge tone="neutral">
                  {t(
                    candidate.ambulance.crew_level === "advanced"
                      ? "ambulancePage.crewAdvanced"
                      : "ambulancePage.crewBasic",
                  )}
                </Badge>
                {index === 0 ? <Badge tone="warning">{t("dispatcher.nearest")}</Badge> : null}
                <span className="ml-auto text-sm font-medium tabular-nums">
                  {t("hospitalChoice.minShort", { count: Math.round(candidate.responseMinutes) })}
                </span>
              </button>
            );
          })
        )}

        {fleet?.rejected.length ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted">{t("dispatcher.notDispatchable")}</p>
            {fleet.rejected.map((entry) => (
              <div
                key={entry.ambulance.id}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <Ban className="size-3.5 shrink-0" />
                <span className="font-medium">{entry.ambulance.callsign}</span>
                <span className="ml-auto text-right text-xs text-danger">
                  {translateReason(entry.reason, t, locale)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

"use client";

import { Ambulance as AmbulanceIcon, Check, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/states";
import { ReasonList } from "@/components/mediroute/reasons";
import { useT } from "@/lib/i18n/context";
import type { AmbulanceCandidate } from "@/lib/mediroute/types";

/**
 * The dispatcher's one decision, stated plainly: which vehicle, and why.
 * No hospital half — that choice now belongs entirely to the crew, made on
 * their own tablet once they're rolling. See ambulance-dashboard.tsx.
 */
export function AssignmentPanel({
  candidate,
  planning,
  assigning,
  onConfirm,
  assignedCallsign,
  assignedHospitalName,
}: {
  candidate: AmbulanceCandidate | undefined;
  planning: boolean;
  assigning: boolean;
  onConfirm: () => void;
  /** Set once the assign write has succeeded — switches this card to a confirmation state. */
  assignedCallsign: string | null;
  /** Filled in once the crew has picked, via the live dispatch poll. */
  assignedHospitalName: string | null | undefined;
}) {
  const t = useT();

  if (assignedCallsign) {
    return (
      <div className="flex items-start gap-2 rounded-card border border-success/40 bg-success/12 px-4 py-3 text-sm">
        <ShieldCheck className="size-4 shrink-0 text-success" />
        <span>
          {t("dispatcher.assignedInfo", { callsign: assignedCallsign })}{" "}
          {assignedHospitalName
            ? t("dispatcher.crewChosen", { hospital: assignedHospitalName })
            : t("dispatcher.choosingOnTablet")}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-warning/40">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <AmbulanceIcon className="size-4 text-warning" />
            {t("dispatcher.recommendedAmbulance")}
          </CardTitle>
          <CardDescription>{t("dispatcher.nearestCertified")}</CardDescription>
        </div>
        {planning ? <Spinner /> : null}
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {candidate ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tracking-tight">
                {candidate.ambulance.callsign}
              </span>
              <Badge tone="neutral">
                {t("dispatcher.crewLabel", {
                  crew: t(
                    candidate.ambulance.crew_level === "advanced"
                      ? "ambulancePage.crewAdvanced"
                      : "ambulancePage.crewBasic",
                  ),
                })}
              </Badge>
              <span className="text-sm text-muted">{candidate.ambulance.operator}</span>
            </div>

            <ReasonList
              reasons={[
                t("dispatcher.minToReach", { count: Math.round(candidate.responseMinutes) }),
                t("dispatcher.kmFromIncident", { km: candidate.distanceKm.toFixed(1) }),
                t("dispatcher.certifiedGpsFix"),
              ]}
            />

            <Button onClick={onConfirm} disabled={assigning} className="self-start">
              <Check className="size-4" />
              {assigning ? t("dispatcher.assigningLabel") : t("dispatcher.assignAmbulanceButton")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-danger">{t("dispatcher.noDispatchable")}</p>
        )}
      </CardBody>
    </Card>
  );
}

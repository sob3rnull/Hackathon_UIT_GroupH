"use client";

import { useMemo, useState } from "react";
import {
  Ambulance as AmbulanceIcon,
  ClipboardList,
  Hospital as HospitalIcon,
  Search,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Stat, StatGrid } from "@/components/ui/stat";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { SeverityBadge } from "@/components/mediroute/status";
import { useT } from "@/lib/i18n/context";
import { useDispatches, type DispatchRecord } from "@/lib/mediroute/use-dispatches";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { severities } from "@/lib/mediroute/types";
import type { Ambulance } from "@/lib/mediroute/types";
import { timeAgo } from "@/lib/utils";

/**
 * Incident history.
 *
 * A dispatch row records what was decided, not what happened afterwards —
 * there is no status column on the table. Rather than add one, the status is
 * derived: only the most recent run for a given vehicle can still be in
 * progress, so that row reflects the vehicle's live status and every earlier
 * row is complete by definition. Nothing new is stored to make this work.
 */

type StatusKey = "completed" | "transporting" | "onScene" | "enRoute";
type IncidentStatus = { labelKey: StatusKey; tone: "neutral" | "accent" | "success" | "warning" };

/** StatusKey → the dictionary's history.status* key. */
const STATUS_LABEL_KEYS: Record<StatusKey, string> = {
  completed: "history.statusCompleted",
  transporting: "history.statusTransporting",
  onScene: "history.statusOnScene",
  enRoute: "history.statusEnRoute",
};

function deriveStatuses(
  dispatches: DispatchRecord[],
  ambulances: Ambulance[],
): Map<string, IncidentStatus> {
  const byId = new Map(ambulances.map((a) => [a.id, a]));
  const seenVehicles = new Set<string>();
  const statuses = new Map<string, IncidentStatus>();

  // The API returns newest first, so the first row for a vehicle is its
  // current run and everything after it is history.
  for (const dispatch of dispatches) {
    const vehicle = dispatch.ambulance_id ? byId.get(dispatch.ambulance_id) : undefined;
    const isCurrentRun =
      dispatch.ambulance_id != null && !seenVehicles.has(dispatch.ambulance_id);

    if (dispatch.ambulance_id) seenVehicles.add(dispatch.ambulance_id);

    if (!isCurrentRun || !vehicle || vehicle.status === "available") {
      statuses.set(dispatch.id, { labelKey: "completed", tone: "neutral" });
      continue;
    }

    statuses.set(
      dispatch.id,
      vehicle.status === "transporting"
        ? { labelKey: "transporting", tone: "accent" }
        : vehicle.status === "on_scene"
          ? { labelKey: "onScene", tone: "accent" }
          : vehicle.status === "dispatched"
            ? { labelKey: "enRoute", tone: "warning" }
            : { labelKey: "completed", tone: "neutral" },
    );
  }

  return statuses;
}

export function HistoryPanel() {
  const t = useT();
  const { dispatches, total, overrides, agreementRate, loading, error } =
    useDispatches();
  const { hospitals } = useHospitals();
  const { ambulances } = useFleet();

  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [outcome, setOutcome] = useState("all");

  const hospitalName = useMemo(
    () => new Map(hospitals.map((h) => [h.id, h.short_name])),
    [hospitals],
  );
  const callsign = useMemo(
    () => new Map(ambulances.map((a) => [a.id, a.callsign])),
    [ambulances],
  );

  const statuses = useMemo(
    () => deriveStatuses(dispatches, ambulances),
    [dispatches, ambulances],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return dispatches.filter((row) => {
      if (severity !== "all" && row.severity !== severity) return false;
      if (outcome === "override" && !row.was_override) return false;
      if (outcome === "agreed" && row.was_override) return false;
      if (!needle) return true;

      const haystack = [
        row.patient_note,
        row.condition,
        row.severity,
        row.required_specialty,
        row.hospital_id ? hospitalName.get(row.hospital_id) : "",
        row.ambulance_id ? callsign.get(row.ambulance_id) : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [dispatches, query, severity, outcome, hospitalName, callsign]);

  if (loading) return <Skeleton rows={5} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <Stat
          label={t("history.incidentsLabel")}
          value={total}
          icon={<ClipboardList className="size-3.5" />}
        />
        <Stat
          label={t("history.followedRecommendation")}
          value={total ? total - overrides : 0}
          sub={
            agreementRate != null
              ? t("history.agreementPercent", { percent: Math.round(agreementRate * 100) })
              : t("history.noIncidentsYet")
          }
          tone="success"
          icon={<ThumbsUp className="size-3.5" />}
        />
        <Stat
          label={t("history.dispatcherOverrides")}
          value={overrides}
          sub={t("history.humanChoseDifferent")}
          tone={overrides > 0 ? "warning" : "neutral"}
        />
        <Stat
          label={t("history.inProgress")}
          value={
            [...statuses.values()].filter((s) => s.labelKey !== "completed").length
          }
          sub={t("history.crewsStillOnRun")}
          tone="accent"
        />
      </StatGrid>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("history.searchPlaceholder")}
            aria-label={t("history.searchAriaLabel")}
            className="pl-9"
          />
        </div>

        <Select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          aria-label={t("history.filterSeverityAria")}
          className="sm:w-44"
        >
          <option value="all">{t("history.allSeverities")}</option>
          {severities.map((value) => (
            <option key={value} value={value}>
              {t(`status.severity.${value}`)}
            </option>
          ))}
        </Select>

        <Select
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          aria-label={t("history.filterOutcomeAria")}
          className="sm:w-52"
        >
          <option value="all">{t("history.allDecisions")}</option>
          <option value="agreed">{t("history.followedRecommendationOption")}</option>
          <option value="override">{t("history.dispatcherOverrideOption")}</option>
        </Select>
      </div>

      {/* ── Incidents ────────────────────────────────────────────────────── */}
      {dispatches.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={t("history.noIncidentsYet")}
          body={t("history.noIncidentsBody")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title={t("history.noMatching")}
          body={t("history.noMatchingBody")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => {
            const status = statuses.get(row.id) ?? {
              labelKey: "completed" as const,
              tone: "neutral" as const,
            };

            return (
              <Card key={row.id}>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={row.severity} />
                    <Badge tone="neutral">{t(`status.condition.${row.condition}`)}</Badge>
                    {row.needs_icu ? <Badge tone="danger">{t("history.icuBadge")}</Badge> : null}
                    {row.was_override ? (
                      <Badge tone="warning">{t("history.dispatcherOverrideOption")}</Badge>
                    ) : null}
                    <Badge tone={status.tone}>{t(STATUS_LABEL_KEYS[status.labelKey])}</Badge>
                    <time
                      className="ml-auto text-xs text-muted"
                      dateTime={row.created_at}
                      title={new Date(row.created_at).toLocaleString()}
                    >
                      {timeAgo(row.created_at)}
                    </time>
                  </div>

                  <p className="text-sm">
                    {row.patient_note || t("ambulancePage.noDescriptionRecorded")}
                  </p>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                    <span className="flex items-center gap-1.5">
                      <AmbulanceIcon className="size-3.5" />
                      {row.ambulance_id
                        ? (callsign.get(row.ambulance_id) ?? t("history.unknownVehicle"))
                        : t("history.noVehicleAssigned")}
                      {row.response_eta_minutes
                        ? t("history.minToSceneShort", {
                            count: Math.round(row.response_eta_minutes),
                          })
                        : null}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <HospitalIcon className="size-3.5" />
                      {row.hospital_id
                        ? (hospitalName.get(row.hospital_id) ?? t("history.unknownHospital"))
                        : t("history.hospitalNotChosen")}
                      {row.eta_minutes
                        ? t("history.minTransportShort", { count: Math.round(row.eta_minutes) })
                        : null}
                    </span>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

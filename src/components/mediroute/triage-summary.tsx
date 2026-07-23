"use client";

import { Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { SeverityBadge } from "@/components/mediroute/status";
import { useT } from "@/lib/i18n/context";
import {
  conditions,
  severities,
  type Condition,
  type Severity,
  type Triage,
} from "@/lib/mediroute/types";

export type TriageSource = "claude" | "keyword" | "manual" | null;

/**
 * What the AI read out of the description, and the crew's chance to disagree
 * with it. Editing any field re-labels the source as "manual" — the record
 * shows who actually made the call. Runs on the Ambulance page, not the
 * dispatcher's screen: selectAmbulance() never needed this, so it never made
 * sense to extract it before a vehicle was even picked.
 */
export function TriageSummary({
  triage,
  source,
  sourceNote,
  onPatch,
}: {
  triage: Triage | null;
  source: TriageSource;
  sourceNote: string | null;
  onPatch: (patch: Partial<Triage>) => void;
}) {
  const t = useT();

  if (!triage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="size-4" />
            {t("triageSummary.title")}
          </CardTitle>
          <CardDescription>{t("triageSummary.appearsOnceRun")}</CardDescription>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={<Stethoscope className="size-6" />}
            title={t("triageSummary.noTriageYet")}
            body={t("triageSummary.noTriageBody")}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="size-4" />
          {t("triageSummary.title")}
        </CardTitle>
        <CardDescription>
          {source === "claude" ? (
            <span className="text-success">
              {t("triageSummary.confidence", { percent: Math.round(triage.confidence * 100) })}
            </span>
          ) : source === "manual" ? (
            <span>{t("triageSummary.correctedManually")}</span>
          ) : (
            <span className="text-warning">
              {t("triageSummary.keywordFallback", {
                percent: Math.round(triage.confidence * 100),
              })}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {sourceNote ? (
          <p className="rounded-lg bg-warning/12 px-3 py-2 text-xs text-warning">
            {sourceNote}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SeverityBadge severity={triage.severity} />
          <Badge tone="accent">{t(`status.specialty.${triage.requiredSpecialty}`)}</Badge>
          {triage.needsICU ? (
            <Badge tone="danger">{t("triageSummary.needsIcuBadge")}</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("triageSummary.condition")} htmlFor="condition">
            <Select
              id="condition"
              value={triage.condition}
              onChange={(e) => onPatch({ condition: e.target.value as Condition })}
            >
              {conditions.map((c) => (
                <option key={c} value={c}>
                  {t(`status.condition.${c}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("triageSummary.severity")} htmlFor="severity">
            <Select
              id="severity"
              value={triage.severity}
              onChange={(e) => onPatch({ severity: e.target.value as Severity })}
            >
              {severities.map((s) => (
                <option key={s} value={s}>
                  {t(`status.severity.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={triage.needsICU}
            onChange={(e) => onPatch({ needsICU: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          {t("triageSummary.needsIcu")}
        </label>

        {triage.redFlags.length ? (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted">{t("triageSummary.findings")}</p>
            <ul className="flex flex-col gap-1">
              {triage.redFlags.map((flag, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-danger">•</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

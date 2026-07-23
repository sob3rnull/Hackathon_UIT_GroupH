"use client";

import { Ban, Hospital as HospitalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateReason } from "@/lib/i18n/translate-reason";
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
  const t = useT();
  const { locale } = useLocale();

  // Counterfactual: what plain distance-only routing would do. If the hospital
  // closest by ETA is one the engine hard-filtered out (can't treat this
  // patient), it is by definition not our recommendation — so name it and say
  // why it was excluded. Derived entirely from what recommend() already returns.
  const recommended = rec?.ranked[0] ?? null;
  const nearestByEta = rec
    ? [...rec.ranked, ...rec.excluded].reduce<
        (typeof rec.excluded)[number] | (typeof rec.ranked)[number] | null
      >((best, entry) => (!best || entry.etaMinutes < best.etaMinutes ? entry : best), null)
    : null;
  const counterfactual =
    recommended &&
    nearestByEta &&
    nearestByEta.hospital.id !== recommended.hospital.id &&
    "reason" in nearestByEta
      ? nearestByEta
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HospitalIcon className="size-4" />
          {t("hospitalChoice.title")}
        </CardTitle>
        <CardDescription>
          {rec
            ? t("hospitalChoice.summary", {
                ranked: rec.ranked.length,
                excluded: rec.excluded.length,
              })
            : t("hospitalChoice.loading")}
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-2">
        {!rec ? (
          <EmptyState
            icon={<HospitalIcon className="size-6" />}
            title={t("hospitalChoice.rankingTitle")}
            body={t("hospitalChoice.rankingBody")}
          />
        ) : rec.ranked.length === 0 ? (
          <p className="text-sm text-danger">{t("hospitalChoice.noneCanTake")}</p>
        ) : (
          <>
          {counterfactual ? (
            <p className="rounded-lg border border-dashed border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {t("hospitalChoice.counterfactual", {
                name: counterfactual.hospital.short_name,
                reason: translateReason(counterfactual.reason, t, locale),
              })}
            </p>
          ) : null}
          {rec.ranked.map((entry, index) => {
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
                  {index === 0 ? <Badge tone="accent">{t("hospitalChoice.recommended")}</Badge> : null}
                  {isSelected && index !== 0 ? (
                    <Badge tone="warning">{t("hospitalChoice.yourChoice")}</Badge>
                  ) : null}
                  <span className="ml-auto text-base font-medium tabular-nums">
                    {t("hospitalChoice.minShort", { count: Math.round(entry.etaMinutes) })}
                  </span>
                </div>

                <p className="text-sm text-muted">
                  {t("hospitalChoice.bedsIcuLine", {
                    beds: entry.hospital.available_beds,
                    icu: entry.hospital.icu_beds_free,
                    specialists,
                    specialty: t(`status.specialty.${rec.triage.requiredSpecialty}`),
                    er: erPercent,
                  })}
                </p>
              </button>
            );
          })}
          </>
        )}

        {rec?.excluded.length ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted">{t("hospitalChoice.cannotTake")}</p>
            {rec.excluded.map((entry) => (
              <div
                key={entry.hospital.id}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <Ban className="size-3.5 shrink-0" />
                <span className="font-medium">{entry.hospital.short_name}</span>
                <span className="text-xs">
                  {t("hospitalChoice.minShort", { count: Math.round(entry.etaMinutes) })}
                </span>
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

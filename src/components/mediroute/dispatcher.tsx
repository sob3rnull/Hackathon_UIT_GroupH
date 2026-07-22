"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  Ban,
  Check,
  Radio,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import { IncidentMap } from "@/components/mediroute/map";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import {
  conditions,
  severities,
  specialtyFor,
  type ApiResult,
  type Condition,
  type LatLng,
  type Recommendation,
  type Severity,
  type Triage,
} from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

const DEFAULT_ORIGIN: LatLng = { lat: 16.7769, lng: 96.1592 };

const EXAMPLE =
  "55M, crushing central chest pain radiating to left arm, diaphoretic, BP 90/60, GCS 14";

interface TriageResponse {
  triage: Triage;
  source: "claude" | "keyword";
  note?: string;
}

const severityTone: Record<Severity, "danger" | "warning" | "success"> = {
  critical: "danger",
  urgent: "warning",
  stable: "success",
};

export function Dispatcher() {
  const { hospitals, loading, error, live, revision } = useHospitals();

  const [note, setNote] = useState(EXAMPLE);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [source, setSource] = useState<"claude" | "keyword" | "manual" | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);

  const [origin, setOrigin] = useState<LatLng>(DEFAULT_ORIGIN);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [ranking, setRanking] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<{ name: string; eta: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/triage")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r?.data?.aiAvailable ?? false))
      .catch(() => setAiAvailable(false));
  }, []);

  const rank = useCallback(
    async (t: Triage, at: LatLng, silent = false) => {
      if (!silent) setRanking(true);
      setActionError(null);
      try {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triage: t, origin: at }),
        });
        const result: ApiResult<Recommendation> = await response.json();
        if (!result.ok) throw new Error(result.error);
        setRec(result.data);
        setSelectedId((current) =>
          current && result.data.ranked.some((r) => r.hospital.id === current)
            ? current
            : (result.data.ranked[0]?.hospital.id ?? null),
        );
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Ranking failed");
      } finally {
        setRanking(false);
      }
    },
    [],
  );

  // Live re-rank: capacity changed somewhere else, so redo the ranking and
  // flag it. This is the demo's peak moment — a bed freed on the hospital
  // panel reorders this list with no refresh.
  useEffect(() => {
    if (revision === 0 || !triage) return;
    // Reacting to an external realtime event (a capacity change on another
    // machine) — the documented escape hatch for this rule. Once per event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleNotice(true);
    void rank(triage, origin, true);
    const timer = setTimeout(() => setStaleNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [revision, triage, origin, rank]);

  async function handleTriage() {
    setTriaging(true);
    setActionError(null);
    setDispatched(null);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const result: ApiResult<TriageResponse> = await response.json();
      if (!result.ok) throw new Error(result.error);

      setTriage(result.data.triage);
      setSource(result.data.source);
      setSourceNote(result.data.note ?? null);
      await rank(result.data.triage, origin);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Triage failed");
    } finally {
      setTriaging(false);
    }
  }

  /** Dispatcher edits the triage by hand — the override that keeps a human in the loop. */
  function patchTriage(patch: Partial<Triage>) {
    if (!triage) return;
    const next: Triage = { ...triage, ...patch };
    if (patch.condition) next.requiredSpecialty = specialtyFor[patch.condition];
    setTriage(next);
    setSource("manual");
    setSourceNote(null);
    setDispatched(null);
    void rank(next, origin);
  }

  function moveAmbulance(point: LatLng) {
    setOrigin(point);
    setDispatched(null);
    if (triage) void rank(triage, point);
  }

  async function confirmDispatch() {
    if (!rec || !selectedId) return;
    const chosen = rec.ranked.find((r) => r.hospital.id === selectedId);
    if (!chosen) return;

    setActionError(null);
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospital_id: chosen.hospital.id,
          recommended_hospital_id: rec.ranked[0]?.hospital.id ?? null,
          patient_note: note,
          condition: rec.triage.condition,
          severity: rec.triage.severity,
          required_specialty: rec.triage.requiredSpecialty,
          needs_icu: rec.triage.needsICU,
          eta_minutes: Math.round(chosen.etaMinutes),
        }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      setDispatched({
        name: chosen.hospital.name,
        eta: Math.round(chosen.etaMinutes),
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Dispatch failed");
    }
  }

  const excludedIds = new Set(rec?.excluded.map((e) => e.hospital.id) ?? []);
  const topId = rec?.ranked[0]?.hospital.id ?? null;
  const isOverride = Boolean(selectedId && topId && selectedId !== topId);

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] lg:items-start">
      {/* ── Left column: intake ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ambulance className="size-4 text-danger" />
              Patient intake
            </CardTitle>
            <CardDescription>
              Type what the paramedic says. No dropdowns mid-emergency.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Field label="Paramedic note" htmlFor="note">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="e.g. 30F, motorcycle collision, open tibia fracture, alert"
              />
            </Field>

            <Button onClick={handleTriage} disabled={triaging || note.trim().length < 3}>
              {triaging ? <Spinner /> : <Sparkles className="size-4" />}
              {triaging ? "Triaging…" : "Run triage"}
            </Button>

            {aiAvailable === false ? (
              <p className="text-xs text-warning">
                No <code>ANTHROPIC_API_KEY</code> set — using the keyword fallback.
                Add the key to <code>.env.local</code> for real AI triage.
              </p>
            ) : null}
          </CardBody>
        </Card>

        {triage ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="size-4" />
                Triage result
              </CardTitle>
              <CardDescription>
                {source === "claude" ? (
                  <span className="text-success">
                    Extracted by Claude · {Math.round(triage.confidence * 100)}% confidence
                  </span>
                ) : source === "manual" ? (
                  <span>Set manually by dispatcher</span>
                ) : (
                  <span className="text-warning">
                    Keyword fallback — not AI · {Math.round(triage.confidence * 100)}% confidence
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

              {/* Always-visible manual override. The model proposes; the human disposes. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Condition" htmlFor="condition">
                  <Select
                    id="condition"
                    value={triage.condition}
                    onChange={(e) => patchTriage({ condition: e.target.value as Condition })}
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Severity" htmlFor="severity">
                  <Select
                    id="severity"
                    value={triage.severity}
                    onChange={(e) => patchTriage({ severity: e.target.value as Severity })}
                  >
                    {severities.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={triage.needsICU}
                  onChange={(e) => patchTriage({ needsICU: e.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                />
                Needs ICU on arrival
              </label>

              <div className="flex flex-wrap gap-2">
                <Badge tone={severityTone[triage.severity]}>{triage.severity}</Badge>
                <Badge tone="accent">{triage.requiredSpecialty}</Badge>
                {triage.needsICU ? <Badge tone="danger">ICU</Badge> : null}
              </div>

              {triage.redFlags.length ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted">
                    Why — traceable to the note
                  </p>
                  <ul className="flex flex-col gap-1">
                    {triage.redFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-danger">•</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* ── Right column: map + ranking ─────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Live map</CardTitle>
              <CardDescription>Click anywhere to move the ambulance.</CardDescription>
            </div>
            <Badge tone={live ? "success" : "neutral"}>
              <Radio className="size-3" />
              {live ? "Realtime" : "Polling"}
            </Badge>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton rows={1} />
            ) : (
              <IncidentMap
                hospitals={hospitals}
                origin={origin}
                recommendedId={topId}
                selectedId={selectedId}
                excludedIds={excludedIds}
                onPickOrigin={moveAmbulance}
              />
            )}
          </CardBody>
        </Card>

        {error ? <ErrorState message={error} /> : null}
        {actionError ? <ErrorState message={actionError} /> : null}

        {staleNotice ? (
          <div className="flex items-center gap-2 rounded-card border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
            <Radio className="size-4 shrink-0 text-accent" />
            Hospital capacity changed — ranking updated.
          </div>
        ) : null}

        {dispatched ? (
          <div className="flex items-center gap-2 rounded-card border border-success/40 bg-success/12 px-4 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success" />
            Dispatched to <strong>{dispatched.name}</strong> · pre-alert sent · ETA{" "}
            {dispatched.eta} min
          </div>
        ) : null}

        {rec?.relaxed ? (
          <div className="flex items-start gap-2 rounded-card border border-danger/50 bg-danger/12 px-4 py-3 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-danger" />
            <span className="text-danger">
              <strong>No fully-equipped hospital available.</strong> Critical-severity
              requirements were relaxed to return any option — verify before dispatching.
            </span>
          </div>
        ) : null}

        {rec ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Recommendation</CardTitle>
                <CardDescription>
                  {rec.ranked.length} eligible · {rec.excluded.length} filtered out
                </CardDescription>
              </div>
              {ranking ? <Spinner /> : null}
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {rec.ranked.length === 0 ? (
                <p className="text-sm text-danger">
                  No hospital can take this patient. Escalate manually.
                </p>
              ) : (
                rec.ranked.map((entry, index) => {
                  const isTop = index === 0;
                  const isSelected = entry.hospital.id === selectedId;
                  return (
                    <button
                      key={entry.hospital.id}
                      onClick={() => {
                        setSelectedId(entry.hospital.id);
                        setDispatched(null);
                      }}
                      className={cn(
                        "flex flex-col gap-2 rounded-card border p-4 text-left transition-colors",
                        isSelected
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-surface-muted/50 hover:border-accent/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{entry.hospital.name}</span>
                        {isTop ? <Badge tone="accent">Recommended</Badge> : null}
                        {isSelected && !isTop ? (
                          <Badge tone="warning">Dispatcher override</Badge>
                        ) : null}
                        <span className="ml-auto font-mono text-sm text-muted">
                          {entry.score.toFixed(3)}
                        </span>
                      </div>

                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {entry.reasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>

                      {/* Score breakdown — the explainability the judges will ask about. */}
                      <div className="flex gap-3 text-xs text-muted">
                        {(
                          [
                            ["travel", entry.parts.travel],
                            ["beds", entry.parts.beds],
                            ["doctors", entry.parts.doctors],
                            ["ER", entry.parts.erLoad],
                          ] as const
                        ).map(([label, value]) => (
                          <span key={label} className="flex items-center gap-1">
                            {label}
                            <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-border">
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${Math.round(value * 100)}%` }}
                              />
                            </span>
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}

              {rec.ranked.length > 0 ? (
                <Button onClick={confirmDispatch} className="mt-1">
                  <Check className="size-4" />
                  {isOverride ? "Dispatch override" : "Confirm dispatch"}
                </Button>
              ) : null}

              {rec.excluded.length ? (
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted">
                    Filtered out — not ranked, excluded
                  </p>
                  {rec.excluded.map((entry) => (
                    <div
                      key={entry.hospital.id}
                      className="flex items-center gap-2 text-sm text-muted"
                    >
                      <Ban className="size-3.5 shrink-0" />
                      <span className="font-medium">{entry.hospital.short_name}</span>
                      <span className="text-xs">
                        {Math.round(entry.etaMinutes)} min away
                      </span>
                      <span className="ml-auto text-xs text-danger">{entry.reason}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

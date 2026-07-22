"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  Ban,
  Check,
  Radio,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import { IncidentMap } from "@/components/mediroute/map";
import { VoiceInput } from "@/components/mediroute/voice-input";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import { useFleet } from "@/lib/mediroute/use-fleet";
import {
  backendMode,
  getPlan,
  runTriage,
  sendDispatch,
} from "@/lib/mediroute/backend";
import {
  conditions,
  severities,
  specialtyFor,
  type AmbulanceSelection,
  type Condition,
  type LatLng,
  type Recommendation,
  type Severity,
  type Triage,
} from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

const DEFAULT_INCIDENT: LatLng = { lat: 16.7769, lng: 96.1592 };

const EXAMPLE =
  "55M, crushing central chest pain radiating to left arm, diaphoretic, BP 90/60, GCS 14";

const severityTone: Record<Severity, "danger" | "warning" | "success"> = {
  critical: "danger",
  urgent: "warning",
  stable: "success",
};

export function Dispatcher() {
  const { hospitals, loading, error, live, revision } = useHospitals();
  const { ambulances, revision: fleetRevision } = useFleet();

  const [incident, setIncident] = useState<LatLng>(DEFAULT_INCIDENT);

  const [note, setNote] = useState(EXAMPLE);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [source, setSource] = useState<"claude" | "keyword" | "manual" | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);

  const [fleetPick, setFleetPick] = useState<AmbulanceSelection | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);

  const [rec, setRec] = useState<Recommendation | null>(null);
  const [ranking, setRanking] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<{
    hospital: string;
    callsign: string | null;
    response: number;
    transport: number;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/triage")
      .then((r) => r.json())
      .then((r) => setAiAvailable(r?.data?.aiAvailable ?? false))
      .catch(() => setAiAvailable(false));
  }, []);

  /**
   * One planning call covers both steps of the 119 flow: which vehicle goes to
   * the patient, and which hospital the patient goes to. n8n answers it in a
   * single round trip; the local backend composes the same shape from two
   * routes. See lib/mediroute/backend.ts.
   */
  const rank = useCallback(async (t: Triage, at: LatLng, silent = false) => {
    if (!silent) setRanking(true);
    setActionError(null);
    try {
      const plan = await getPlan(t, at);

      setFleetPick(plan.fleet);
      setAssignedId((current) =>
        current && plan.fleet.candidates.some((c) => c.ambulance.id === current)
          ? current
          : (plan.fleet.candidates[0]?.ambulance.id ?? null),
      );

      setRec(plan.hospitals);
      setSelectedId((current) =>
        current && plan.hospitals.ranked.some((r) => r.hospital.id === current)
          ? current
          : (plan.hospitals.ranked[0]?.hospital.id ?? null),
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Planning failed");
    } finally {
      setRanking(false);
    }
  }, []);

  // Live re-plan when hospital capacity or fleet status changes elsewhere.
  useEffect(() => {
    if ((revision === 0 && fleetRevision === 0) || !triage) return;
    // Reacting to an external realtime event (a change on another machine) —
    // the documented escape hatch for this rule. Once per event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleNotice(true);
    void rank(triage, incident, true);
    const timer = setTimeout(() => setStaleNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [revision, fleetRevision, triage, incident, rank]);

  async function handleTriage() {
    setTriaging(true);
    setActionError(null);
    setDispatched(null);
    try {
      const result = await runTriage(note);

      setTriage(result.triage);
      setSource(result.source);
      setSourceNote(result.note ?? null);
      await rank(result.triage, incident);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Triage failed");
    } finally {
      setTriaging(false);
    }
  }

  function patchTriage(patch: Partial<Triage>) {
    if (!triage) return;
    const next: Triage = { ...triage, ...patch };
    if (patch.condition) next.requiredSpecialty = specialtyFor[patch.condition];
    setTriage(next);
    setSource("manual");
    setSourceNote(null);
    setDispatched(null);
    void rank(next, incident);
  }

  function moveIncident(point: LatLng) {
    setIncident(point);
    setDispatched(null);
    if (triage) void rank(triage, point);
  }

  async function confirmDispatch() {
    if (!rec || !selectedId) return;
    const chosen = rec.ranked.find((r) => r.hospital.id === selectedId);
    if (!chosen) return;

    const assigned = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);

    setActionError(null);
    try {
      await sendDispatch({
        hospital_id: chosen.hospital.id,
        recommended_hospital_id: rec.ranked[0]?.hospital.id ?? null,
        ambulance_id: assigned?.ambulance.id ?? null,
        patient_note: note,
        condition: rec.triage.condition,
        severity: rec.triage.severity,
        required_specialty: rec.triage.requiredSpecialty,
        needs_icu: rec.triage.needsICU,
        eta_minutes: Math.round(chosen.etaMinutes),
        response_eta_minutes: Math.round(assigned?.responseMinutes ?? 0),
        incident_lat: incident.lat,
        incident_lng: incident.lng,
        input_mode: inputMode,
      });

      setDispatched({
        hospital: chosen.hospital.name,
        callsign: assigned?.ambulance.callsign ?? null,
        response: Math.round(assigned?.responseMinutes ?? 0),
        transport: Math.round(chosen.etaMinutes),
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Dispatch failed");
    }
  }

  const excludedIds = new Set(rec?.excluded.map((e) => e.hospital.id) ?? []);
  const topId = rec?.ranked[0]?.hospital.id ?? null;
  const isOverride = Boolean(selectedId && topId && selectedId !== topId);
  const assigned = fleetPick?.candidates.find((c) => c.ambulance.id === assignedId);

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] lg:items-start">
      {/* ── Left: intake ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AmbulanceIcon className="size-4 text-danger" />
              119 call intake
            </CardTitle>
            <CardDescription>
              Dictate or type what the caller reports. Click the map to set the
              incident location.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <VoiceInput
              disabled={triaging}
              onListeningChange={(listening) => {
                if (listening) {
                  setNote("");
                  setInputMode("voice");
                }
              }}
              onTranscript={setNote}
            />

            <Field label="Patient description" htmlFor="note">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setInputMode("text");
                }}
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
                    Keyword fallback — not AI · {Math.round(triage.confidence * 100)}%
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
                    Why — traceable to the description
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

      {/* ── Right: map, fleet, hospitals ─────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Live map</CardTitle>
              <CardDescription>
                Click to move the incident. Squares are ambulances reporting GPS.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={backendMode === "n8n" ? "accent" : "neutral"}>
                {backendMode === "n8n" ? "n8n backend" : "local backend"}
              </Badge>
              <Badge tone={live ? "success" : "neutral"}>
                <Radio className="size-3" />
                {live ? "Realtime" : "Polling"}
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton rows={1} />
            ) : (
              <IncidentMap
                hospitals={hospitals}
                origin={incident}
                ambulances={ambulances}
                assignedAmbulanceId={assignedId}
                recommendedId={topId}
                selectedId={selectedId}
                excludedIds={excludedIds}
                onPickOrigin={moveIncident}
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
          <div className="flex items-start gap-2 rounded-card border border-success/40 bg-success/12 px-4 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success" />
            <span>
              {dispatched.callsign ? <strong>{dispatched.callsign}</strong> : "Ambulance"}{" "}
              dispatched to <strong>{dispatched.hospital}</strong> · pre-alert sent ·{" "}
              {dispatched.response} min to scene, {dispatched.transport} min to hospital
              (total {dispatched.response + dispatched.transport} min to definitive care)
            </span>
          </div>
        ) : null}

        {/* ── Step 1: assign an ambulance ───────────────────────────────── */}
        {fleetPick ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AmbulanceIcon className="size-4" />
                Nearest available ambulance
              </CardTitle>
              <CardDescription>
                {fleetPick.candidates.length} dispatchable · {fleetPick.rejected.length}{" "}
                unavailable. Only certified vehicles with a fresh GPS fix are listed.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              {fleetPick.candidates.length === 0 ? (
                <p className="text-sm text-danger">
                  No dispatchable ambulance. Escalate manually.
                </p>
              ) : (
                fleetPick.candidates.map((candidate, index) => {
                  const isAssigned = candidate.ambulance.id === assignedId;
                  return (
                    <button
                      key={candidate.ambulance.id}
                      onClick={() => {
                        setAssignedId(candidate.ambulance.id);
                        setDispatched(null);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-card border p-3 text-left transition-colors",
                        isAssigned
                          ? "border-warning bg-warning/12"
                          : "border-border bg-surface-muted/50 hover:border-warning/40",
                      )}
                    >
                      <ShieldCheck className="size-4 shrink-0 text-success" />
                      <span className="font-semibold">{candidate.ambulance.callsign}</span>
                      <Badge tone="neutral">{candidate.ambulance.crew_level}</Badge>
                      <span className="text-sm text-muted">
                        {candidate.ambulance.operator}
                      </span>
                      {index === 0 ? <Badge tone="warning">Nearest</Badge> : null}
                      <span className="ml-auto font-mono text-sm">
                        {Math.round(candidate.responseMinutes)} min
                      </span>
                    </button>
                  );
                })
              )}

              {fleetPick.rejected.length ? (
                <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted">Not dispatchable</p>
                  {fleetPick.rejected.map((entry) => (
                    <div
                      key={entry.ambulance.id}
                      className="flex items-center gap-2 text-sm text-muted"
                    >
                      <Ban className="size-3.5 shrink-0" />
                      <span className="font-medium">{entry.ambulance.callsign}</span>
                      <span className="ml-auto text-xs text-danger">{entry.reason}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
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

        {/* ── Step 2: choose the hospital ───────────────────────────────── */}
        {rec ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Destination hospital</CardTitle>
                <CardDescription>
                  {rec.ranked.length} eligible · {rec.excluded.length} filtered out ·
                  times are the transport leg from the incident
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
                  const total =
                    Math.round(entry.etaMinutes) + Math.round(assigned?.responseMinutes ?? 0);
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

                      {assigned ? (
                        <p className="text-xs text-muted">
                          Total to definitive care:{" "}
                          <span className="font-medium text-foreground">{total} min</span>{" "}
                          ({Math.round(assigned.responseMinutes)} to scene +{" "}
                          {Math.round(entry.etaMinutes)} to hospital)
                        </p>
                      ) : null}

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
                <Button
                  onClick={confirmDispatch}
                  disabled={!assignedId}
                  className="mt-1"
                >
                  <Check className="size-4" />
                  {!assignedId
                    ? "Assign an ambulance first"
                    : isOverride
                      ? "Dispatch override"
                      : "Confirm dispatch"}
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

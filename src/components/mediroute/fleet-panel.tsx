"use client";

import { useEffect, useState } from "react";
import { Radio, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useFleet } from "@/lib/mediroute/use-fleet";
import { ambulanceStatuses, type Ambulance, type AmbulanceStatus } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/**
 * Stands in for the on-board IoT units.
 *
 * In production each vehicle's device PATCHes /api/ambulances/[id] with its
 * GPS fix and status on a timer; nobody touches this screen. It exists so the
 * demo can show the certification gate and the stale-GPS rule without needing
 * actual hardware in the room.
 */
export function FleetPanel() {
  const { ambulances, loading, error, live, reload } = useFleet();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  // GPS-fix ages are relative to "now", but reading the clock during render is
  // impure and would mismatch between server and client HTML. Keep the clock
  // in state, seeded after mount and ticked every 30s.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Syncing with an external system (the clock) — the documented exception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function patch(
    ambulance: Ambulance,
    body: Record<string, unknown>,
  ) {
    setBusyId(ambulance.id);
    setWriteError(null);
    try {
      const response = await fetch(`/api/ambulances/${ambulance.id}`, {
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
          Stands in for the on-board IoT units reporting position and status.
        </p>
      </div>

      {writeError ? <ErrorState message={writeError} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {ambulances.map((ambulance) => {
          const busy = busyId === ambulance.id;
          const fixAge =
            ambulance.gps_fix_at && now !== null
              ? Math.round((now - new Date(ambulance.gps_fix_at).getTime()) / 60000)
              : null;

          return (
            <Card key={ambulance.id} className={cn(busy && "opacity-60")}>
              <CardHeader className="flex-row items-start justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2">
                    {ambulance.callsign}
                    <Badge tone={ambulance.certified ? "success" : "danger"}>
                      {ambulance.certified ? (
                        <ShieldCheck className="size-3" />
                      ) : (
                        <ShieldOff className="size-3" />
                      )}
                      {ambulance.certified ? "Certified" : "Uncertified"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {ambulance.operator} · {ambulance.crew_level} crew ·{" "}
                    {ambulance.device_id ?? "no IoT unit fitted"}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm font-medium">Status</span>
                  <Select
                    value={ambulance.status}
                    disabled={busy}
                    aria-label={`Status for ${ambulance.callsign}`}
                    onChange={(e) =>
                      patch(ambulance, { status: e.target.value as AmbulanceStatus })
                    }
                    className="h-8 w-40 text-xs"
                  >
                    {ambulanceStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">GPS fix</span>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      fixAge === null || fixAge > 10 ? "text-danger" : "text-muted",
                    )}
                  >
                    {fixAge === null
                      ? "none"
                      : fixAge < 1
                        ? "just now"
                        : `${fixAge} min ago`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      patch(ambulance, {
                        lat: ambulance.lat ?? 16.7769,
                        lng: ambulance.lng ?? 96.1592,
                        gps_fix_at: new Date().toISOString(),
                      })
                    }
                    className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-muted disabled:opacity-40"
                  >
                    Report fresh GPS fix
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => patch(ambulance, { certified: !ambulance.certified })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-muted disabled:opacity-40"
                  >
                    {ambulance.certified ? "Revoke certification" : "Certify (device fitted)"}
                  </button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

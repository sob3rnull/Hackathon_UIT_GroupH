"use client";

import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { IncidentMap } from "@/components/mediroute/map";
import {
  GoogleIncidentMap,
  googleMapsAvailable,
} from "@/components/mediroute/google-map";
import { backendMode } from "@/lib/mediroute/backend";
import type { Ambulance, Hospital, LatLng } from "@/lib/mediroute/types";

/**
 * The map, plus the two badges that answer "is this actually live?" before a
 * judge has to ask. The Google/offline toggle exists so the fallback path can
 * be rehearsed rather than discovered on stage.
 */
export function MapPanel({
  hospitals,
  ambulances,
  incident,
  loading,
  live,
  mapMode,
  onToggleMapMode,
  onFallback,
  assignedAmbulanceId,
  recommendedId,
  selectedId,
  excludedIds,
  onPickOrigin,
}: {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  incident: LatLng;
  loading: boolean;
  live: boolean;
  mapMode: "google" | "svg";
  onToggleMapMode: () => void;
  onFallback: () => void;
  assignedAmbulanceId: string | null;
  recommendedId: string | null;
  selectedId: string | null;
  excludedIds: Set<string>;
  onPickOrigin: (point: LatLng) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>Live map</CardTitle>
          <CardDescription>
            Click to move the incident. Squares are ambulances reporting GPS.
          </CardDescription>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {googleMapsAvailable ? (
            <button
              onClick={onToggleMapMode}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              title="Switch between the Google basemap and the offline map"
            >
              {mapMode === "google" ? "Offline map" : "Google map"}
            </button>
          ) : null}
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
        ) : mapMode === "google" ? (
          <GoogleIncidentMap
            hospitals={hospitals}
            origin={incident}
            ambulances={ambulances}
            assignedAmbulanceId={assignedAmbulanceId}
            recommendedId={recommendedId}
            selectedId={selectedId}
            excludedIds={excludedIds}
            onPickOrigin={onPickOrigin}
            onFallback={onFallback}
          />
        ) : (
          <IncidentMap
            hospitals={hospitals}
            origin={incident}
            ambulances={ambulances}
            assignedAmbulanceId={assignedAmbulanceId}
            recommendedId={recommendedId}
            selectedId={selectedId}
            excludedIds={excludedIds}
            onPickOrigin={onPickOrigin}
          />
        )}
      </CardBody>
    </Card>
  );
}

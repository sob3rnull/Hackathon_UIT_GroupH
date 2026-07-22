"use client";

import { useMemo } from "react";
import type { Ambulance, Hospital, LatLng } from "@/lib/mediroute/types";
import { cn } from "@/lib/utils";

/**
 * Deliberately not Mapbox or Google Maps.
 *
 * Tile-based maps fetch at render time, so bad venue wifi turns the panel into
 * a grey box in front of judges — and both need an API key in the client
 * bundle. This projects lat/lng straight into an SVG viewBox: no key, no
 * network, no dependency, and it cannot fail on stage.
 *
 * Swap in real tiles only if the MVP lands early and the venue wifi is proven.
 */

const W = 560;
const H = 420;
const PAD = 44;

interface MapProps {
  hospitals: Hospital[];
  /** The incident location — where the patient is. */
  origin: LatLng;
  /** Vehicles with a GPS fix, drawn as small markers. */
  ambulances?: Ambulance[];
  /** The assigned vehicle — drawn with a response leg to the incident. */
  assignedAmbulanceId?: string | null;
  /** Highest-ranked hospital — drawn with a transport leg from the incident. */
  recommendedId?: string | null;
  /** What the dispatcher actually picked, if they overrode. */
  selectedId?: string | null;
  /** Hard-filtered hospitals, drawn dimmed. */
  excludedIds?: Set<string>;
  onPickOrigin?: (point: LatLng) => void;
}

export function IncidentMap({
  hospitals,
  origin,
  ambulances = [],
  assignedAmbulanceId,
  recommendedId,
  selectedId,
  excludedIds,
  onPickOrigin,
}: MapProps) {
  const located = ambulances.filter(
    (a): a is Ambulance & { lat: number; lng: number } =>
      a.lat !== null && a.lng !== null,
  );

  const project = useMemo(() => {
    const lats = [...hospitals.map((h) => h.lat), ...located.map((a) => a.lat), origin.lat];
    const lngs = [...hospitals.map((h) => h.lng), ...located.map((a) => a.lng), origin.lng];

    // Guard against a degenerate span when only one point exists.
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;

    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLng = Math.max(maxLng - minLng, 1e-6);

    return {
      toXY: (p: LatLng) => ({
        // y is flipped: latitude grows north, SVG y grows down.
        x: PAD + ((p.lng - minLng) / spanLng) * (W - PAD * 2),
        y: PAD + ((maxLat - p.lat) / spanLat) * (H - PAD * 2),
      }),
      toLatLng: (x: number, y: number) => ({
        lng: minLng + ((x - PAD) / (W - PAD * 2)) * spanLng,
        lat: maxLat - ((y - PAD) / (H - PAD * 2)) * spanLat,
      }),
    };
    // `located` is derived from `ambulances` on each render, so depend on the
    // prop rather than the derived array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitals, ambulances, origin]);

  const originXY = project.toXY(origin);
  const target = hospitals.find((h) => h.id === (selectedId ?? recommendedId));
  const targetXY = target ? project.toXY(target) : null;
  const assigned = located.find((a) => a.id === assignedAmbulanceId);
  const assignedXY = assigned ? project.toXY(assigned) : null;

  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!onPickOrigin) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    onPickOrigin(project.toLatLng(x, y));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn(
        "w-full rounded-card border border-border bg-surface-muted",
        onPickOrigin && "cursor-crosshair",
      )}
      onClick={handleClick}
      role="img"
      aria-label="Map of hospitals relative to the incident location"
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M 28 0 L 0 0 0 28"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />

      {/* Response leg: assigned ambulance → incident. */}
      {assignedXY ? (
        <line
          x1={assignedXY.x}
          y1={assignedXY.y}
          x2={originXY.x}
          y2={originXY.y}
          stroke="var(--warning)"
          strokeWidth="2.5"
          strokeDasharray="3 4"
        />
      ) : null}

      {/* Transport leg: incident → chosen hospital. */}
      {targetXY ? (
        <line
          x1={originXY.x}
          y1={originXY.y}
          x2={targetXY.x}
          y2={targetXY.y}
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeDasharray="7 5"
        />
      ) : null}

      {hospitals.map((hospital) => {
        const { x, y } = project.toXY(hospital);
        const isExcluded = excludedIds?.has(hospital.id) ?? false;
        const isRecommended = hospital.id === recommendedId;
        const isSelected = hospital.id === selectedId;
        const highlighted = isRecommended || isSelected;

        return (
          <g key={hospital.id} opacity={isExcluded ? 0.32 : 1}>
            {/* Name and status on hover only — the panel list beside the map
                already names every hospital; painting text for all of them
                here just adds clutter. */}
            <title>
              {hospital.name}
              {isExcluded ? " — ineligible" : ""}
            </title>
            {highlighted ? (
              <circle cx={x} cy={y} r="15" fill="var(--accent)" opacity="0.18" />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={highlighted ? 8 : 6}
              fill={
                isExcluded
                  ? "var(--muted)"
                  : highlighted
                    ? "var(--accent)"
                    : "var(--success)"
              }
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        );
      })}

      {/* Fleet. Uncertified or unavailable vehicles are drawn hollow. */}
      {located.map((ambulance) => {
        const { x, y } = project.toXY(ambulance);
        const isAssigned = ambulance.id === assignedAmbulanceId;
        const dispatchable = ambulance.certified && ambulance.status === "available";

        return (
          <g key={ambulance.id} opacity={dispatchable || isAssigned ? 1 : 0.4}>
            <title>
              {ambulance.callsign} ({ambulance.status})
            </title>
            <rect
              x={x - 5}
              y={y - 5}
              width="10"
              height="10"
              rx="2"
              fill={
                isAssigned
                  ? "var(--warning)"
                  : dispatchable
                    ? "var(--surface)"
                    : "var(--muted)"
              }
              stroke={isAssigned ? "var(--warning)" : "var(--muted)"}
              strokeWidth="2"
            />
          </g>
        );
      })}

      {/* Incident marker — where the patient is. */}
      <g>
        <circle cx={originXY.x} cy={originXY.y} r="13" fill="var(--danger)" opacity="0.2" />
        <circle
          cx={originXY.x}
          cy={originXY.y}
          r="7"
          fill="var(--danger)"
          stroke="var(--surface)"
          strokeWidth="2"
        />
        <text
          x={originXY.x}
          y={originXY.y - 16}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="var(--danger)"
        >
          Incident
        </text>
      </g>
    </svg>
  );
}

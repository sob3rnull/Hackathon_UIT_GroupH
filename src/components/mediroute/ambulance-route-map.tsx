"use client";

import { useEffect, useRef, useState } from "react";
import { googleMapsAvailable, loadMapsScript, mapThemeColor } from "@/lib/mediroute/maps-loader";
import { getRoute } from "@/lib/mediroute/backend";
import { decodePolyline } from "@/lib/mediroute/polyline";
import type { LatLng } from "@/lib/mediroute/types";

/**
 * The crew's own route map: one leg, the real road path, not the dispatcher's
 * many-vehicle overview (google-map.tsx). Origin/destination and which leg
 * it is are resolved by the caller from the mission + vehicle status — this
 * component only draws.
 *
 * Own Map instance (a separate billable load from the dispatcher's map, paid
 * once per crew session — this page stays open for a shift the same way the
 * dispatcher's does), but shares the <script> tag via maps-loader.ts.
 *
 * Real road geometry costs a Routes API call per leg change, debounced so a
 * burst of GPS heartbeats coalesces into one fetch. On any failure — no key,
 * no network, Google error — falls back to the dispatcher map's dashed
 * straight-line style rather than showing nothing.
 */
export function AmbulanceRouteMap({
  origin,
  destination,
  originLabel,
  destinationLabel,
  legColor,
}: {
  origin: LatLng;
  destination: LatLng;
  originLabel: string;
  destinationLabel: string;
  /** "warning" for the response leg (still en route to the patient), "accent" for the transport leg (patient on board, en route to hospital). */
  legColor: "warning" | "accent";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<(google.maps.Marker | google.maps.Polyline)[]>([]);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(!googleMapsAvailable);

  // Create the map once per mount — the billable event.
  useEffect(() => {
    if (!googleMapsAvailable) return;
    let cancelled = false;

    loadMapsScript()
      .then((g) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new g.maps.Map(containerRef.current, {
          center: origin,
          zoom: 13,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
    };
    // origin intentionally only used as the initial center — re-running this
    // effect would create a second Map instance, a second billable load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route fetch + overlay draw, debounced against rapid GPS updates.
  useEffect(() => {
    if (!ready || fallback) return;
    const map = mapRef.current;
    if (!map || typeof google === "undefined") return;

    let cancelled = false;

    const draw = (path: LatLng[] | null) => {
      if (cancelled) return;
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];

      const color = mapThemeColor(`--${legColor}`, "#c78a2b");
      const add = (overlay: google.maps.Marker | google.maps.Polyline) => {
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      };

      add(new google.maps.Marker({ position: origin, title: originLabel, zIndex: 10 }));
      add(
        new google.maps.Marker({
          position: destination,
          title: destinationLabel,
          zIndex: 10,
          icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 8 },
        }),
      );

      if (path && path.length > 1) {
        add(new google.maps.Polyline({ path, strokeColor: color, strokeOpacity: 0.9, strokeWeight: 5 }));
      } else {
        // No road geometry — same dashed schematic language as the overview map.
        add(
          new google.maps.Polyline({
            path: [origin, destination],
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 3 },
                offset: "0",
                repeat: "12px",
              },
            ],
          }),
        );
      }

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds, 56);
    };

    const timer = setTimeout(() => {
      void getRoute(origin, destination).then((result) => {
        if (cancelled) return;
        draw(result ? decodePolyline(result.polyline) : null);
      });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Keyed on coordinates, not the origin/destination object references —
    // the caller recomputes those from polled data (fleet/dispatch feeds),
    // so a new object with the SAME lat/lng arrives on every poll tick. This
    // is a billed Routes API call; it should only re-fire when the actual
    // position changed, not on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    fallback,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    originLabel,
    destinationLabel,
    legColor,
  ]);

  if (fallback) {
    return (
      <div className="flex h-64 items-center justify-center rounded-card border border-border bg-surface-muted text-sm text-muted">
        Map unavailable — see the ETA above.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-card border border-border bg-surface-muted"
      aria-label={`Route from ${originLabel} to ${destinationLabel}`}
    />
  );
}

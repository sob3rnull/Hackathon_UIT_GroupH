"use client";

import { useEffect, useRef, useState } from "react";
import type { Ambulance, Hospital, LatLng } from "@/lib/mediroute/types";

/**
 * Google Maps basemap for the dispatcher.
 *
 * ── Billing model, because it shapes this whole file ─────────────────────
 * Maps JavaScript API bills PER MAP LOAD — every `new google.maps.Map()` is
 * one billable event (10k free/month on the Essentials tier). Pan, zoom,
 * marker moves and polyline updates are free.
 *
 * So the rules here are:
 *   1. The <script> loads once per browser session (module-level promise).
 *   2. The Map object is created ONCE per component mount and reused; every
 *      later prop change only updates overlays, which cost nothing.
 *   3. The dispatcher keeps this component mounted for the whole session —
 *      never key it on state or conditionally unmount it, or each remount
 *      burns another map load.
 * One dispatcher tab open all day ≈ 1 billable load.
 *
 * The key in NEXT_PUBLIC_GOOGLE_MAPS_KEY ships in the bundle by design; its
 * protection is the referrer + API restrictions set in Cloud Console.
 * If the script fails (offline venue, blocked, quota), onFallback fires and
 * the parent swaps in the offline SVG map.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const googleMapsAvailable = Boolean(KEY);

declare global {
  interface Window {
    __medirouteMapsReady?: () => void;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

function loadMapsScript(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Maps can only load in the browser"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    window.__medirouteMapsReady = () => resolve(window.google);

    const script = document.createElement("script");
    script.async = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(KEY)}&loading=async&callback=__medirouteMapsReady`;
    script.onerror = () => {
      loaderPromise = null; // allow a retry on the next mount
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

interface GoogleIncidentMapProps {
  hospitals: Hospital[];
  origin: LatLng;
  ambulances?: Ambulance[];
  assignedAmbulanceId?: string | null;
  recommendedId?: string | null;
  selectedId?: string | null;
  excludedIds?: Set<string>;
  onPickOrigin?: (point: LatLng) => void;
  /** Script failed or errored — parent should fall back to the SVG map. */
  onFallback: () => void;
}

export function GoogleIncidentMap({
  hospitals,
  origin,
  ambulances = [],
  assignedAmbulanceId,
  recommendedId,
  selectedId,
  excludedIds,
  onPickOrigin,
  onFallback,
}: GoogleIncidentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<(google.maps.Marker | google.maps.Polyline)[]>([]);
  const clickHandlerRef = useRef(onPickOrigin);
  const [ready, setReady] = useState(false);

  // Keep the map's click listener pointed at the latest handler without ever
  // re-registering it (writing a ref during render trips the compiler lint).
  useEffect(() => {
    clickHandlerRef.current = onPickOrigin;
  }, [onPickOrigin]);

  // Create the map exactly once per mount — this is the billable event.
  useEffect(() => {
    let cancelled = false;

    loadMapsScript()
      .then((g) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new g.maps.Map(containerRef.current, {
          center: { lat: 16.8, lng: 96.16 },
          zoom: 12,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          const position = event.latLng;
          if (position && clickHandlerRef.current) {
            clickHandlerRef.current({ lat: position.lat(), lng: position.lng() });
          }
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onFallback();
      });

    return () => {
      cancelled = true;
    };
    // onFallback intentionally omitted: re-running this effect would try to
    // create a second Map instance, i.e. a second billable load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Overlay updates — free of charge, run as often as props change.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || typeof google === "undefined") return;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const add = (overlay: google.maps.Marker | google.maps.Polyline) => {
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    };

    const css = (name: string, fallback: string) =>
      typeof window === "undefined"
        ? fallback
        : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    const accent = css("--accent", "#4c62d6");
    const danger = css("--danger", "#c73b3b");
    const warning = css("--warning", "#c78a2b");
    const success = css("--success", "#2e9e63");
    const muted = css("--muted", "#8a8f9c");

    const circle = (color: string, scale: number): google.maps.Symbol => ({
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale,
    });
    const square = (color: string): google.maps.Symbol => ({
      path: "M -5,-5 5,-5 5,5 -5,5 z",
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: 1,
    });

    const bounds = new google.maps.LatLngBounds();

    // Incident.
    add(
      new google.maps.Marker({
        position: origin,
        icon: circle(danger, 9),
        title: "Incident",
        zIndex: 30,
      }),
    );
    bounds.extend(origin);

    // Hospitals.
    for (const hospital of hospitals) {
      const isExcluded = excludedIds?.has(hospital.id) ?? false;
      const highlighted =
        hospital.id === recommendedId || hospital.id === selectedId;
      add(
        new google.maps.Marker({
          position: { lat: hospital.lat, lng: hospital.lng },
          icon: circle(
            isExcluded ? muted : highlighted ? accent : success,
            highlighted ? 9 : 7,
          ),
          opacity: isExcluded ? 0.45 : 1,
          label: {
            text: hospital.short_name,
            fontSize: "11px",
            fontWeight: highlighted ? "700" : "500",
            className: "mediroute-map-label",
          },
          title: isExcluded ? `${hospital.name} — ineligible` : hospital.name,
          zIndex: highlighted ? 20 : 10,
        }),
      );
      bounds.extend({ lat: hospital.lat, lng: hospital.lng });
    }

    // Fleet.
    for (const ambulance of ambulances) {
      if (ambulance.lat === null || ambulance.lng === null) continue;
      const isAssigned = ambulance.id === assignedAmbulanceId;
      const dispatchable =
        ambulance.certified && ambulance.status === "available";
      add(
        new google.maps.Marker({
          position: { lat: ambulance.lat, lng: ambulance.lng },
          icon: square(isAssigned ? warning : dispatchable ? success : muted),
          opacity: dispatchable || isAssigned ? 1 : 0.5,
          label: {
            text: ambulance.callsign,
            fontSize: "10px",
            fontWeight: isAssigned ? "700" : "400",
            className: "mediroute-map-label",
          },
          title: `${ambulance.callsign} (${ambulance.status})`,
          zIndex: isAssigned ? 25 : 5,
        }),
      );
      bounds.extend({ lat: ambulance.lat, lng: ambulance.lng });
    }

    // Route legs. Straight connectors, deliberately: the ETAs shown in the UI
    // are real Routes API driving times, but fetching drawable road geometry
    // is a separate billable Compute Routes call per pair — decoration not
    // worth paying for. The dashed style signals "schematic, not the road".
    const assigned = ambulances.find((a) => a.id === assignedAmbulanceId);
    if (assigned && assigned.lat !== null && assigned.lng !== null) {
      add(
        new google.maps.Polyline({
          path: [{ lat: assigned.lat, lng: assigned.lng }, origin],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: warning, scale: 3 },
              offset: "0",
              repeat: "12px",
            },
          ],
        }),
      );
    }
    const target = hospitals.find(
      (h) => h.id === (selectedId ?? recommendedId),
    );
    if (target) {
      add(
        new google.maps.Polyline({
          path: [origin, { lat: target.lat, lng: target.lng }],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: accent, scale: 3 },
              offset: "0",
              repeat: "12px",
            },
          ],
        }),
      );
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
  }, [
    ready,
    hospitals,
    ambulances,
    origin,
    assignedAmbulanceId,
    recommendedId,
    selectedId,
    excludedIds,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-105 w-full rounded-card border border-border bg-surface-muted"
      aria-label="Map of hospitals and ambulances relative to the incident"
    />
  );
}

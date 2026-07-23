// Native replacement for the n8n /mediroute/plan webhook. Nodes: Fetch Hospitals ·
// Fetch Ambulances · Build Fleet Matrix Request · Fleet Travel Times · Build
// Hospital Matrix Request · Hospital Travel Times · Select Ambulance And Rank
// Hospitals · Respond Plan.
import { NextResponse } from "next/server";
import { z } from "zod";
import { recommend, selectAmbulance, type TravelOverrides } from "@/lib/mediroute/engine";
import { resolveFeed } from "@/lib/mediroute/feeds/hospital-feed";
import { DEFAULT_ORIGIN, listAmbulances } from "@/lib/mediroute/store";
import { triageSchema, type LatLng } from "@/lib/mediroute/types";

const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const bodySchema = z.object({
  triage: triageSchema,
  incident: latLng.optional(),
});

const KEY = process.env.GOOGLE_ROUTES_API_KEY ?? "";

interface MatrixRow {
  originIndex: number;
  destinationIndex: number;
  duration?: string;
  distanceMeters?: number;
  condition?: string;
}

const waypoint = (p: LatLng) => ({
  waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
});

/**
 * Build Matrix Request + Travel Times: computeRouteMatrix over origins ×
 * destinations, duration/distance only. Returns null on a missing key or any
 * failure — the engine then falls back to haversine, exactly as when absent.
 */
async function routeMatrix(
  origins: LatLng[],
  destinations: LatLng[],
): Promise<MatrixRow[] | null> {
  if (!KEY || origins.length === 0 || destinations.length === 0) return null;
  try {
    const response = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,condition",
        },
        body: JSON.stringify({
          origins: origins.map(waypoint),
          destinations: destinations.map(waypoint),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as MatrixRow[];
  } catch {
    return null;
  }
}

const overrideFromRow = (row: MatrixRow) => {
  const seconds = parseFloat(String(row.duration ?? "").replace("s", ""));
  if (row.condition !== "ROUTE_EXISTS" || !Number.isFinite(seconds)) return null;
  return { etaMinutes: seconds / 60, distanceKm: (row.distanceMeters ?? 0) / 1000 };
};

/** Fleet + hospital plan for an incident — the /mediroute/plan contract. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const incident = parsed.data.incident ?? DEFAULT_ORIGIN;

    // Fetch Hospitals / Fetch Ambulances
    const [hospitals, ambulances] = await Promise.all([
      resolveFeed().getAvailability(),
      listAmbulances(),
    ]);

    // Fleet Travel Times — ambulances with a GPS position, matrix → incident.
    const located = ambulances.filter((a) => a.lat !== null && a.lng !== null);
    const fleetOverrides: TravelOverrides = {};
    const fleetRows = await routeMatrix(
      located.map((a) => ({ lat: a.lat as number, lng: a.lng as number })),
      [incident],
    );
    for (const row of fleetRows ?? []) {
      const o = overrideFromRow(row);
      const ambulance = located[row.originIndex];
      if (o && ambulance) fleetOverrides[ambulance.id] = o;
    }

    // Hospital Travel Times — incident → each hospital.
    const hospitalOverrides: TravelOverrides = {};
    const hospitalRows = await routeMatrix(
      [incident],
      hospitals.map((h) => ({ lat: h.lat, lng: h.lng })),
    );
    for (const row of hospitalRows ?? []) {
      const o = overrideFromRow(row);
      const hospital = hospitals[row.destinationIndex];
      if (o && hospital) hospitalOverrides[hospital.id] = o;
    }

    // Select Ambulance And Rank Hospitals + Respond Plan
    return NextResponse.json({
      ok: true,
      data: {
        fleet: selectAmbulance(ambulances, incident, new Date(), fleetOverrides),
        hospitals: recommend(hospitals, parsed.data.triage, incident, hospitalOverrides),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Plan failed" },
      { status: 500 },
    );
  }
}

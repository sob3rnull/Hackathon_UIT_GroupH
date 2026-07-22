import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Real driving-route geometry for one origin/destination pair — the ambulance
 * page's route map, not the ranking engine.
 *
 * This is a DIFFERENT Google endpoint than the one the ranking pipeline uses.
 * Fleet/hospital ranking (locally via the TravelOverrides seam in engine.ts,
 * or in the n8n workflow) calls computeRouteMatrix, which returns only
 * duration and distance — cheaper, and all a ranking needs. Drawing an actual
 * road path needs computeRoutes, which additionally returns polyline geometry.
 * Both are billed separately; this route is called once per mission, when the
 * crew's current leg (assigned → scene, or scene → hospital) is first shown.
 *
 * Never called from the ranking pipeline, and has no n8n equivalent — it's a
 * rendering concern for whichever frontend page needs a road-shaped line,
 * independent of which backend (local or n8n) is answering /mediroute/plan.
 */

const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const bodySchema = z.object({
  origin: latLng,
  destination: latLng,
});

const KEY = process.env.GOOGLE_ROUTES_API_KEY ?? "";

export interface RouteResult {
  etaMinutes: number;
  distanceKm: number;
  /** Encoded polyline, Google's standard algorithm — decode client-side. */
  polyline: string;
}

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

  // No key configured: tell the caller plainly rather than 500. The route map
  // falls back to a straight line when this comes back not-ok — it cannot
  // fail the page, only lose the road shape.
  if (!KEY) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_ROUTES_API_KEY not configured" },
      { status: 200 },
    );
  }

  const { origin, destination } = parsed.data;

  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: {
            location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { ok: false, error: `Routes API ${response.status}: ${detail.slice(0, 200)}` },
        { status: 200 },
      );
    }

    const data = await response.json();
    const route = data?.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;
    const durationSeconds = parseFloat(String(route?.duration ?? "").replace("s", ""));
    const distanceMeters = route?.distanceMeters;

    if (!encodedPolyline || !Number.isFinite(durationSeconds)) {
      return NextResponse.json(
        { ok: false, error: "No route returned" },
        { status: 200 },
      );
    }

    const result: RouteResult = {
      etaMinutes: durationSeconds / 60,
      distanceKm: (distanceMeters ?? 0) / 1000,
      polyline: encodedPolyline,
    };
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Routes request failed" },
      { status: 200 },
    );
  }
}

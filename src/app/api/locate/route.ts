import "server-only";

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { resolveLandmark } from "@/lib/mediroute/landmarks";

const bodySchema = z.object({
  text: z.string().trim().min(3, "Describe the incident").max(2000),
});

/**
 * What Claude extracts. Deliberately NO coordinates — the model only *names* a
 * place. Coordinates come from our own gazetteer, or (fallback) from Google
 * Geocoding, never from the model, so a hallucinated lat/lng can't reach the map.
 */
// Terse descriptions/prompt keep the per-call input tokens down.
const extractionSchema = z.object({
  landmark: z
    .string()
    .describe(
      "The single Yangon place the incident is nearest to — landmark, junction, " +
        "township, market, university, hospital, hotel, street or building — in " +
        "English if recognised. Empty if the note names no location.",
    ),
  incidentType: z.string().describe("Short incident type, e.g. 'traffic collision'."),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `Read a 119 dispatcher's incident note from Yangon, Myanmar (English/Burmese). Return the single place the incident is nearest to — a landmark, junction, township, market, pagoda, lake, station, airport, university, hospital, hotel, street or building — and a short incident type. NEVER output coordinates. No usable location → empty landmark, low confidence.`;

/** Greater-Yangon bounding box — a geocode outside it is rejected as wrong. */
const YANGON_BOUNDS = { minLat: 16.6, maxLat: 17.2, minLng: 95.85, maxLng: 96.55 };

/**
 * Resolve a place name to coordinates via Google Geocoding, biased and bounded
 * to greater Yangon. Server-side key only (GOOGLE_GEOCODING_API_KEY, falling
 * back to GOOGLE_ROUTES_API_KEY if that key also has the Geocoding API enabled).
 * Returns null on a missing key, no match, an out-of-bounds hit, or any error —
 * the caller then falls back to "click the map". Google supplies the geometry;
 * the model never sees or emits a coordinate.
 */
async function geocodeInYangon(
  place: string,
): Promise<{ name: string; lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    address: `${place}, Yangon, Myanmar`,
    components: "country:MM",
    bounds: `${YANGON_BOUNDS.minLat},${YANGON_BOUNDS.minLng}|${YANGON_BOUNDS.maxLat},${YANGON_BOUNDS.maxLng}`,
    region: "mm",
    key,
  });

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    if (data.status !== "OK") return null;
    const loc = data.results?.[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;
    if (
      loc.lat < YANGON_BOUNDS.minLat ||
      loc.lat > YANGON_BOUNDS.maxLat ||
      loc.lng < YANGON_BOUNDS.minLng ||
      loc.lng > YANGON_BOUNDS.maxLng
    ) {
      return null;
    }
    return { name: place, lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

/** Dispatcher note → { landmark, incidentType, confidence } → gazetteer coords. */
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

  // No key → no extraction. The caller treats this exactly like "couldn't
  // infer": unchanged behaviour, "click the map".
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, data: { resolved: false } });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      // Haiku 4.5 — cheapest capable model; the output is a tiny landmark object.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: parsed.data.text }],
      output_config: { format: zodOutputFormat(extractionSchema) },
    });

    const extracted = response.parsed_output;
    if (!extracted || !extracted.landmark.trim()) {
      return NextResponse.json({ ok: true, data: { resolved: false } });
    }

    // 1) Curated gazetteer first — instant, offline, hand-checked coordinates.
    const gazetteer = resolveLandmark(extracted.landmark);
    // 2) Google Geocoding fallback for anything not in the list (bounded to Yangon).
    const point = gazetteer
      ? { name: gazetteer.name, lat: gazetteer.lat, lng: gazetteer.lng }
      : await geocodeInYangon(extracted.landmark);

    if (!point) {
      return NextResponse.json({ ok: true, data: { resolved: false } });
    }

    return NextResponse.json({
      ok: true,
      data: {
        resolved: true,
        landmark: point.name,
        incidentType: extracted.incidentType,
        confidence: extracted.confidence,
        lat: point.lat,
        lng: point.lng,
      },
    });
  } catch {
    // Any model/network failure is a soft failure: tell the client it's
    // unresolved and let it fall back to map-click, never a hard error on stage.
    return NextResponse.json({ ok: true, data: { resolved: false } });
  }
}

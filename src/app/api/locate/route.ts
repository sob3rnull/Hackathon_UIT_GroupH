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
 * What Claude extracts. Deliberately NO coordinates — the model names a
 * landmark and we look the coordinates up in our own gazetteer, so a
 * hallucinated lat/lng can never reach the map.
 */
const extractionSchema = z.object({
  landmark: z
    .string()
    .describe(
      "The single Yangon place or landmark the incident is nearest to, in " +
        "English if you recognise it (e.g. 'Sule Pagoda', 'Hledan Junction'). " +
        "Empty string if the note names no location.",
    ),
  incidentType: z
    .string()
    .describe("Short description of what happened, e.g. 'traffic collision'."),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `You read a 119 ambulance dispatcher's note about an incident in
Yangon, Myanmar. The note may be English, Burmese, or a mix.

Return the single Yangon landmark or place name the incident is closest to, plus
a short incident type. Prefer well-known landmarks, junctions, townships,
markets, pagodas, lakes, stations and the airport.

You MUST NOT output coordinates, latitude or longitude — only a place name. If
the note gives no usable location, return an empty landmark string with low
confidence. Be honest with confidence: a vague or location-free note is low.`;

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
      model: "claude-opus-4-8",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: parsed.data.text }],
      output_config: { format: zodOutputFormat(extractionSchema) },
    });

    const extracted = response.parsed_output;
    const landmark = extracted ? resolveLandmark(extracted.landmark) : null;

    if (!extracted || !landmark) {
      return NextResponse.json({ ok: true, data: { resolved: false } });
    }

    return NextResponse.json({
      ok: true,
      data: {
        resolved: true,
        landmark: landmark.name,
        incidentType: extracted.incidentType,
        confidence: extracted.confidence,
        lat: landmark.lat,
        lng: landmark.lng,
      },
    });
  } catch {
    // Any model/network failure is a soft failure: tell the client it's
    // unresolved and let it fall back to map-click, never a hard error on stage.
    return NextResponse.json({ ok: true, data: { resolved: false } });
  }
}

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
// Terse descriptions/prompt keep the per-call input tokens down.
const extractionSchema = z.object({
  landmark: z
    .string()
    .describe("Nearest Yangon place/landmark in English if recognised, else empty."),
  incidentType: z.string().describe("Short incident type, e.g. 'traffic collision'."),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `Read a 119 dispatcher's incident note from Yangon, Myanmar (English/Burmese). Return the single nearest well-known Yangon place name (junction, township, market, pagoda, lake, station, airport) and a short incident type. NEVER output coordinates. No usable location → empty landmark, low confidence.`;

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

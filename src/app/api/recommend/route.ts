import { NextResponse } from "next/server";
import { z } from "zod";
import { recommend } from "@/lib/mediroute/engine";
import { DEFAULT_ORIGIN, listHospitals } from "@/lib/mediroute/store";
import { triageSchema } from "@/lib/mediroute/types";

const bodySchema = z.object({
  triage: triageSchema,
  origin: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

/** Run the matching engine against current hospital state. */
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
    const hospitals = await listHospitals();
    const origin = parsed.data.origin ?? DEFAULT_ORIGIN;
    return NextResponse.json({
      ok: true,
      data: recommend(hospitals, parsed.data.triage, origin),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ranking failed" },
      { status: 500 },
    );
  }
}

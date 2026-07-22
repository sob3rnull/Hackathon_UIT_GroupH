import { NextResponse } from "next/server";
import { z } from "zod";
import { selectAmbulance } from "@/lib/mediroute/engine";
import { DEFAULT_ORIGIN, listAmbulances } from "@/lib/mediroute/store";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await listAmbulances() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load" },
      { status: 500 },
    );
  }
}

const bodySchema = z.object({
  incident: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

/** Rank the fleet for an incident: nearest certified, available, GPS-fresh first. */
export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — fall back to the default incident location.
  }

  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const fleet = await listAmbulances();
    const incident = parsed.data.incident ?? DEFAULT_ORIGIN;
    return NextResponse.json({
      ok: true,
      data: { ...selectAmbulance(fleet, incident), incident },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Selection failed" },
      { status: 500 },
    );
  }
}

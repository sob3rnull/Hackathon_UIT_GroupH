import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAmbulance } from "@/lib/mediroute/store";
import { ambulanceStatuses } from "@/lib/mediroute/types";

const patchSchema = z.object({
  status: z.enum(ambulanceStatuses).optional(),
  certified: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** Set when the on-board IoT unit reports a new position. */
  gps_fix_at: z.string().optional(),
});

/**
 * The endpoint the on-board IoT unit would call to report position and status.
 * Today it is also driven by the fleet panel for the demo.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // A position report is only meaningful with a timestamp — stamp it here if
  // the device didn't, so the stale-GPS rule has something to work with.
  const patch = { ...parsed.data };
  if ((patch.lat !== undefined || patch.lng !== undefined) && !patch.gps_fix_at) {
    patch.gps_fix_at = new Date().toISOString();
  }

  try {
    return NextResponse.json({ ok: true, data: await updateAmbulance(id, patch) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { updateHospital } from "@/lib/mediroute/store";

const patchSchema = z.object({
  available_beds: z.number().int().min(0).max(5000).optional(),
  icu_beds_free: z.number().int().min(0).max(500).optional(),
  current_er_queue: z.number().int().min(0).max(500).optional(),
  doctors_on_duty: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
});

/** Hospital capacity panel writes here. Note: params is a Promise in Next 16. */
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

  try {
    return NextResponse.json({ ok: true, data: await updateHospital(id, parsed.data) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}

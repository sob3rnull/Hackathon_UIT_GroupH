import { NextResponse } from "next/server";
import { z } from "zod";
import { createDispatch, listDispatches } from "@/lib/mediroute/store";

const bodySchema = z.object({
  hospital_id: z.string().min(1),
  recommended_hospital_id: z.string().min(1).nullable(),
  patient_note: z.string().max(2000).default(""),
  condition: z.string().default("general"),
  severity: z.string().default("urgent"),
  required_specialty: z.string().default("general"),
  needs_icu: z.boolean().default(false),
  eta_minutes: z.number().min(0).default(0),
});

/**
 * Confirm a dispatch. Both patient context and hospital travel together so
 * the mass-casualty case (several patients in flight at once) works without
 * a rewrite — the original outline put only the hospital in the URL.
 */
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

  const input = parsed.data;
  // Derived server-side so the agreement stat can't be skewed by the client.
  const was_override =
    input.recommended_hospital_id !== null &&
    input.recommended_hospital_id !== input.hospital_id;

  try {
    const row = await createDispatch({ ...input, was_override });
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Dispatch failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const rows = await listDispatches();
    const overrides = rows.filter((r) => r.was_override).length;
    return NextResponse.json({
      ok: true,
      data: {
        dispatches: rows,
        total: rows.length,
        overrides,
        // Agreement, not "accuracy" — there is no ground truth about which
        // hospital was actually correct, only whether the human concurred.
        agreementRate: rows.length ? 1 - overrides / rows.length : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load" },
      { status: 500 },
    );
  }
}

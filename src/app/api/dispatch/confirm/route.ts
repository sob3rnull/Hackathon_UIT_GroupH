import { NextResponse } from "next/server";
import { z } from "zod";
import { updateDispatch } from "@/lib/mediroute/store";

const bodySchema = z.object({
  dispatch_id: z.string().min(1),
  /** The crew's own description — may extend or replace the dispatcher's optional note. */
  patient_note: z.string().max(2000).default(""),
  condition: z.string().default("general"),
  severity: z.string().default("urgent"),
  required_specialty: z.string().default("general"),
  needs_icu: z.boolean().default(false),
  hospital_id: z.string().min(1),
  recommended_hospital_id: z.string().min(1).nullable(),
  eta_minutes: z.number().min(0).default(0),
});

/**
 * The crew's confirmation: everything the dispatcher's assign-time write
 * couldn't know yet. Triage runs on the crew's own screen, not the
 * dispatcher's — selectAmbulance() only needs the incident location, so
 * there was never a reason to ask the dispatcher for it. This fills in the
 * row assignAmbulance created, once.
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

  const {
    dispatch_id,
    patient_note,
    condition,
    severity,
    required_specialty,
    needs_icu,
    hospital_id,
    recommended_hospital_id,
    eta_minutes,
  } = parsed.data;
  const was_override =
    recommended_hospital_id !== null && recommended_hospital_id !== hospital_id;

  try {
    const row = await updateDispatch(dispatch_id, {
      patient_note,
      condition,
      severity,
      required_specialty,
      needs_icu,
      hospital_id,
      recommended_hospital_id,
      eta_minutes,
      was_override,
    });
    return NextResponse.json({ ok: true, data: row });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}

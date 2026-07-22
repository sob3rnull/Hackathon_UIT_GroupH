import { NextResponse } from "next/server";
import { z } from "zod";
import { updateDispatch } from "@/lib/mediroute/store";

const bodySchema = z.object({
  dispatch_id: z.string().min(1),
  hospital_id: z.string().min(1),
  recommended_hospital_id: z.string().min(1).nullable(),
  eta_minutes: z.number().min(0).default(0),
});

/**
 * The crew's half of confirming a dispatch: which hospital they're taking the
 * patient to. Separate from POST /api/dispatch because that call already ran
 * — at assign time, on the dispatcher's screen, before this hospital was
 * known. This fills in the row it created.
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

  const { dispatch_id, hospital_id, recommended_hospital_id, eta_minutes } = parsed.data;
  const was_override =
    recommended_hospital_id !== null && recommended_hospital_id !== hospital_id;

  try {
    const row = await updateDispatch(dispatch_id, {
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

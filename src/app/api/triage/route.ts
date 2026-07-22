import { NextResponse } from "next/server";
import { z } from "zod";
import { runTriage, hasAnthropicKey } from "@/lib/mediroute/triage";

const bodySchema = z.object({
  note: z.string().trim().min(3, "Describe the patient").max(2000),
});

/** Free-text paramedic note → structured triage. */
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
    const result = await runTriage(parsed.data.note);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Triage failed" },
      { status: 500 },
    );
  }
}

/** Lets the UI show whether the AI path is even configured. */
export async function GET() {
  return NextResponse.json({ ok: true, data: { aiAvailable: hasAnthropicKey } });
}

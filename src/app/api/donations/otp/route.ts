import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/mediroute/otp";
import { myanmarPhonePattern } from "@/lib/mediroute/types";

const bodySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(myanmarPhonePattern, "Enter a Myanmar mobile number (09…)"),
});

/**
 * Issue a verification code for a wallet payment. Demo: with no SMS gateway
 * available the code comes back in the response and the UI presents it as a
 * "Demo SMS" — swap this for a real SMS send to go live.
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

  const code = requestOtp(parsed.data.phone);
  return NextResponse.json({
    ok: true,
    data: { sent: true, expires_in_minutes: 5, demo_code: code },
  });
}

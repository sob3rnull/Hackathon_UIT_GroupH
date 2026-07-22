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

  const result = requestOtp(parsed.data.phone);

  if (!result.ok) {
    // Shape matches ApiResult so the existing client error path renders it
    // unchanged; Retry-After is there for anything speaking HTTP properly.
    return NextResponse.json(
      {
        ok: false,
        error: `Too many code requests. Try again in ${result.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      sent: true,
      expires_in_minutes: result.expiresInMinutes,
      demo_code: result.code,
    },
  });
}

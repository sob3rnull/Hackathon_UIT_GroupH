import { NextResponse } from "next/server";
import { z } from "zod";
import { createDonation, donationTotals, listDonations } from "@/lib/mediroute/store";
import {
  myanmarPhonePattern,
  paymentMethods,
  walletMethods,
} from "@/lib/mediroute/types";

const bodySchema = z
  .object({
    hospital_id: z.string().min(1).nullable().default(null),
    donor_name: z.string().trim().min(1, "Please tell us your name").max(80),
    amount: z.number().positive("Amount must be positive").max(10_000_000),
    message: z.string().max(500).default(""),
    // Recorded for display only — no gateway is called, nothing is charged.
    payment_method: z.enum(paymentMethods),
    payer_phone: z.string().trim().max(20).default(""),
  })
  .superRefine((value, ctx) => {
    // Wallets are registered to a phone number — that's the one payer detail
    // the demo records. Bank accounts and card numbers are never accepted.
    if (
      walletMethods.includes(value.payment_method) &&
      !myanmarPhonePattern.test(value.payer_phone)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["payer_phone"],
        message: "Enter the wallet's phone number (09…)",
      });
    }
  });

/** Record a donation. Demo flow — no payment gateway, the row is the receipt. */
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
    const row = await createDonation(parsed.data);
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Donation failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const [donations, totals] = await Promise.all([listDonations(), donationTotals()]);
    return NextResponse.json({ ok: true, data: { donations, totals } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load" },
      { status: 500 },
    );
  }
}

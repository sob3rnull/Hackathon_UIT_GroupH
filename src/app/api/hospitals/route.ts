import { NextResponse } from "next/server";
import { listHospitals } from "@/lib/mediroute/store";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await listHospitals() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load" },
      { status: 500 },
    );
  }
}

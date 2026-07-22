import { NextResponse } from "next/server";
import { storeMode } from "@/lib/mediroute/store";

/** Sanity check for demo day: `curl localhost:3000/api/health` */
export async function GET() {
  return NextResponse.json({
    ok: true,
    store: storeMode(),
    time: new Date().toISOString(),
  });
}

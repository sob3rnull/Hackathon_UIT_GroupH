import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * IoT heartbeat — replaces the n8n workflow's "Schedule, every 2 min" node,
 * which refreshed every certified vehicle's `gps_fix_at` to stand in for the
 * on-board units' own continuous reporting (README: "the units are always
 * online"). Retiring the n8n backend removed that scheduler, so nothing was
 * touching `gps_fix_at` anymore — every vehicle aged past
 * engine.ts's STALE_GPS_MINUTES (10) and the fleet went empty.
 *
 * Called on a schedule (see vercel.json) rather than lazily on read, because
 * the dispatcher's fleet view and useFleet() subscribe to Supabase Realtime
 * directly — a write has to land in the table for either to see it, an
 * on-request touch in one API route wouldn't reach them.
 *
 * Uses the ADMIN client deliberately: a scheduled job has no signed-in user,
 * so the normal cookie-aware client's RLS policies ("crew updates own
 * vehicle" / "dispatcher updates fleet") would reject every write. This is
 * exactly the case server.ts's own comment carves out for createAdminClient().
 *
 * Only touches certified, non-offline vehicles — an offline vehicle is
 * deliberately not reporting (device off / out of service), and an
 * uncertified one (no device_id) never had a fix to refresh.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = createAdminClient();
  if (!db) {
    // No service key (or Supabase not configured) — memory mode has nothing
    // for a cron to touch; the in-memory seed stamps its own timestamp.
    return NextResponse.json({ ok: true, data: { updated: 0 } });
  }

  try {
    const { data, error } = await db
      .from("ambulances")
      .update({ gps_fix_at: new Date().toISOString() })
      .eq("certified", true)
      .neq("status", "offline")
      .select("id");

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: { updated: data?.length ?? 0 } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Heartbeat failed" },
      { status: 500 },
    );
  }
}

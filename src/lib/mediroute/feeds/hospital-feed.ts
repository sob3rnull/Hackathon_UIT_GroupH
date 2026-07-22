import "server-only";

import { listHospitals as listFromStore } from "@/lib/mediroute/store";
import type { Hospital } from "@/lib/mediroute/types";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Where hospital availability actually comes from.
 *
 *  The prototype uses a manually-updated table. The real system reads it from
 *  each hospital's own information system — most Yangon hospitals are already
 *  digitalised, so the data exists; what's missing is the integration and the
 *  agreement to expose it.
 *
 *  This interface is the seam. Everything upstream (the ranking engine, the
 *  API, the UI) talks to `HospitalFeed` and cannot tell which implementation
 *  is behind it, so swapping a hospital from manual entry to a live HIS feed
 *  is a config change, not a rewrite.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface HospitalFeed {
  readonly name: string;
  /** Current availability for every hospital this feed knows about. */
  getAvailability(): Promise<Hospital[]>;
}

/**
 * PROTOTYPE FEED — what runs today.
 *
 * Availability comes from the `hospitals` table, edited by hand on /hospital.
 * That screen stands in for the HIS: same shape of data, human-driven instead
 * of machine-driven. Be straight about this with judges.
 */
export const manualFeed: HospitalFeed = {
  name: "manual",
  getAvailability: () => listFromStore(),
};

/**
 * PRODUCTION FEED — not implemented, and deliberately not faked.
 *
 * The intended shape: each participating hospital exposes a read-only
 * endpoint (or pushes to us) with current bed, ICU, roster and ER-queue
 * counts. We poll or subscribe per hospital, normalise into `Hospital`, and
 * cache with a short TTL.
 *
 * The hard parts are NOT the code:
 *   · one integration per hospital — no shared schema exists across HIS vendors
 *   · a data-sharing agreement per hospital, plus a governing body to mandate it
 *   · staleness policy: a feed that dies must degrade to "unknown", never to
 *     "zero beds" (which would silently exclude a hospital that can help) and
 *     never to a cached optimistic number (which would send an ambulance to a
 *     full hospital). Unknown must be surfaced to the dispatcher as unknown.
 *   · authentication and audit — this is patient-adjacent operational data
 *
 * Implement per hospital, behind the same interface, and let `resolveFeed`
 * mix live and manual sources during rollout.
 */
export class HisHospitalFeed implements HospitalFeed {
  readonly name = "his";

  constructor(private readonly endpoints: Record<string, string>) {}

  getAvailability(): Promise<Hospital[]> {
    throw new Error(
      `HisHospitalFeed is not implemented (${Object.keys(this.endpoints).length} endpoints configured). ` +
        "The prototype runs on the manual feed — see src/lib/mediroute/feeds/hospital-feed.ts.",
    );
  }
}

/**
 * Chooses the feed. Today there is exactly one, and this function exists so
 * that adding a real one later touches this file and nothing else.
 */
export function resolveFeed(): HospitalFeed {
  return manualFeed;
}

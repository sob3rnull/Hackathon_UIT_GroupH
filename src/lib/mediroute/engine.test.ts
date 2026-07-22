import { describe, expect, it } from "vitest";
import { recommend, selectAmbulance, STALE_GPS_MINUTES, WEIGHTS } from "./engine";
import { haversineKm, etaMinutes } from "./geo";
import type { Ambulance, Hospital, LatLng, Triage } from "./types";

/**
 * These exist because the original spec's ranking formula would have sorted
 * backwards — `travelTimeScore = f(distance)` with `f` undefined, sorted
 * descending, recommends the FARTHEST hospital while looking perfectly fine.
 * The first test below is the one that catches that class of bug.
 */

const ORIGIN: LatLng = { lat: 16.7769, lng: 96.1592 }; // downtown Yangon

function hospital(over: Partial<Hospital> & { id: string }): Hospital {
  return {
    name: over.id,
    short_name: over.id,
    description: "",
    lat: ORIGIN.lat,
    lng: ORIGIN.lng,
    specialties: ["cardiology"],
    total_beds: 100,
    available_beds: 20,
    icu_beds_free: 5,
    doctors_on_duty: { cardiology: 2 },
    er_capacity: 30,
    current_er_queue: 5,
    updated_at: new Date(0).toISOString(),
    ...over,
  };
}

const cardiacUrgent: Triage = {
  condition: "cardiac",
  severity: "urgent",
  requiredSpecialty: "cardiology",
  needsICU: false,
  redFlags: [],
  confidence: 1,
};

describe("travel scoring direction", () => {
  it("ranks the nearer hospital above the farther one, all else equal", () => {
    const near = hospital({ id: "near", lat: 16.79, lng: 96.16 });
    const far = hospital({ id: "far", lat: 16.95, lng: 96.25 });

    const { ranked } = recommend([far, near], cardiacUrgent, ORIGIN);

    expect(ranked.map((r) => r.hospital.id)).toEqual(["near", "far"]);
    expect(ranked[0].parts.travel).toBeGreaterThan(ranked[1].parts.travel);
  });

  it("scores travel as zero past the unacceptable threshold rather than going negative", () => {
    const veryFar = hospital({ id: "veryFar", lat: 19.5, lng: 96.16 }); // ~300 km
    const { ranked } = recommend([veryFar], cardiacUrgent, ORIGIN);
    expect(ranked[0].parts.travel).toBe(0);
  });
});

describe("hard eligibility filters", () => {
  it("excludes a hospital with no beds, however close it is", () => {
    const closeButFull = hospital({ id: "full", available_beds: 0 });
    const farWithBeds = hospital({ id: "open", lat: 16.9, lng: 96.2 });

    const { ranked, excluded } = recommend(
      [closeButFull, farWithBeds],
      cardiacUrgent,
      ORIGIN,
    );

    expect(ranked.map((r) => r.hospital.id)).toEqual(["open"]);
    expect(excluded[0].hospital.id).toBe("full");
    expect(excluded[0].reason).toMatch(/no available beds/i);
  });

  it("excludes a hospital lacking the required service", () => {
    const wrongService = hospital({ id: "ortho", specialties: ["orthopaedics"] });
    const { ranked, excluded } = recommend([wrongService], cardiacUrgent, ORIGIN);

    expect(ranked).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/no cardiology service/i);
  });

  it("disqualifies a hospital with no specialist on duty ONLY at critical severity", () => {
    const noSpecialist = hospital({ id: "nodoc", doctors_on_duty: { cardiology: 0 } });

    const urgent = recommend([noSpecialist], cardiacUrgent, ORIGIN);
    expect(urgent.ranked).toHaveLength(1); // penalised, not excluded

    const critical = recommend(
      [noSpecialist],
      { ...cardiacUrgent, severity: "critical" },
      ORIGIN,
    );
    // Only candidate, so the engine relaxes rather than returning nothing —
    // but it must say so.
    expect(critical.relaxed).toBe(true);
  });

  it("requires a free ICU bed for a critical patient who needs one", () => {
    const noIcu = hospital({ id: "noicu", icu_beds_free: 0 });
    const withIcu = hospital({ id: "icu", lat: 16.9, lng: 96.2, icu_beds_free: 3 });

    const { ranked, excluded, relaxed } = recommend(
      [noIcu, withIcu],
      { ...cardiacUrgent, severity: "critical", needsICU: true },
      ORIGIN,
    );

    expect(relaxed).toBe(false);
    expect(ranked.map((r) => r.hospital.id)).toEqual(["icu"]);
    expect(excluded[0].reason).toMatch(/no icu bed/i);
  });
});

describe("severity changes the weighting", () => {
  it("weights travel more heavily for critical than for stable", () => {
    expect(WEIGHTS.critical.travel).toBeGreaterThan(WEIGHTS.stable.travel);
    expect(WEIGHTS.stable.erLoad).toBeGreaterThan(WEIGHTS.critical.erLoad);
  });

  it("every weight profile sums to 1, so scores stay comparable across severities", () => {
    for (const [severity, w] of Object.entries(WEIGHTS)) {
      const total = w.travel + w.beds + w.doctors + w.erLoad;
      expect(total, `${severity} weights must sum to 1`).toBeCloseTo(1, 10);
    }
  });

  it("a jammed ER can lose to a farther quiet hospital for a stable patient", () => {
    const closeJammed = hospital({
      id: "jammed",
      lat: 16.78,
      lng: 96.16,
      current_er_queue: 30,
      er_capacity: 30,
      available_beds: 2,
    });
    const fartherQuiet = hospital({
      id: "quiet",
      lat: 16.85,
      lng: 96.19,
      current_er_queue: 2,
      er_capacity: 30,
      available_beds: 60,
    });

    const { ranked } = recommend(
      [closeJammed, fartherQuiet],
      { ...cardiacUrgent, severity: "stable" },
      ORIGIN,
    );

    expect(ranked[0].hospital.id).toBe("quiet");
  });
});

describe("degenerate inputs", () => {
  it("does not divide by zero when only one hospital is eligible", () => {
    const only = hospital({ id: "only" });
    const { ranked } = recommend([only], cardiacUrgent, ORIGIN);

    expect(ranked).toHaveLength(1);
    expect(Number.isFinite(ranked[0].score)).toBe(true);
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("returns empty rather than throwing when nothing is eligible", () => {
    const useless = hospital({ id: "none", specialties: [], available_beds: 0 });
    const { ranked, excluded } = recommend([useless], cardiacUrgent, ORIGIN);

    expect(ranked).toHaveLength(0);
    expect(excluded).toHaveLength(1);
  });

  it("handles a hospital with zero total beds without producing NaN", () => {
    const zeroed = hospital({ id: "zero", total_beds: 0, available_beds: 1 });
    const { ranked } = recommend([zeroed], cardiacUrgent, ORIGIN);
    expect(Number.isNaN(ranked[0].score)).toBe(false);
  });

  it("keeps every score component within 0..1", () => {
    const odd = hospital({
      id: "odd",
      available_beds: 500,
      total_beds: 100, // inconsistent data — must still clamp
      current_er_queue: 90,
      er_capacity: 30,
      doctors_on_duty: { cardiology: 99 },
    });
    const { ranked } = recommend([odd], cardiacUrgent, ORIGIN);

    for (const value of Object.values(ranked[0].parts)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("ambulance selection", () => {
  const NOW = new Date("2026-07-22T10:00:00Z");
  const fresh = new Date(NOW.getTime() - 60_000).toISOString(); // 1 min old

  function amb(over: Partial<Ambulance> & { id: string }): Ambulance {
    return {
      callsign: over.id,
      operator: "Test EMS",
      device_id: "IOT-0000",
      certified: true,
      lat: ORIGIN.lat,
      lng: ORIGIN.lng,
      gps_fix_at: fresh,
      status: "available",
      crew_level: "basic",
      updated_at: NOW.toISOString(),
      ...over,
    };
  }

  it("orders dispatchable vehicles nearest first", () => {
    const near = amb({ id: "near", lat: 16.78, lng: 96.16 });
    const far = amb({ id: "far", lat: 16.87, lng: 96.19 });

    const { candidates } = selectAmbulance([far, near], ORIGIN, NOW);

    expect(candidates.map((c) => c.ambulance.id)).toEqual(["near", "far"]);
    expect(candidates[0].responseMinutes).toBeLessThan(candidates[1].responseMinutes);
  });

  it("rejects an uncertified vehicle even when it is the closest", () => {
    const closestUncertified = amb({
      id: "uncertified",
      certified: false,
      device_id: null,
      lat: ORIGIN.lat,
      lng: ORIGIN.lng,
    });
    const fartherCertified = amb({ id: "certified", lat: 16.8, lng: 96.17 });

    const { candidates, rejected } = selectAmbulance(
      [closestUncertified, fartherCertified],
      ORIGIN,
      NOW,
    );

    // The certification gate must beat proximity — this is the whole point of
    // requiring the IoT unit before a vehicle can be dispatched.
    expect(candidates.map((c) => c.ambulance.id)).toEqual(["certified"]);
    expect(rejected[0].reason).toMatch(/no iot unit/i);
  });

  it("rejects vehicles that are not available", () => {
    const busy = amb({ id: "busy", status: "transporting" });
    const { candidates, rejected } = selectAmbulance([busy], ORIGIN, NOW);

    expect(candidates).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/unavailable \(transporting\)/i);
  });

  it("rejects a vehicle whose GPS fix is stale", () => {
    const stale = amb({
      id: "stale",
      gps_fix_at: new Date(NOW.getTime() - (STALE_GPS_MINUTES + 5) * 60_000).toISOString(),
    });
    const { candidates, rejected } = selectAmbulance([stale], ORIGIN, NOW);

    expect(candidates).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/gps fix \d+ min old/i);
  });

  it("accepts a fix that is fresh enough", () => {
    const ok = amb({
      id: "ok",
      gps_fix_at: new Date(NOW.getTime() - (STALE_GPS_MINUTES - 1) * 60_000).toISOString(),
    });
    expect(selectAmbulance([ok], ORIGIN, NOW).candidates).toHaveLength(1);
  });

  it("rejects a vehicle with no position at all", () => {
    const noFix = amb({ id: "nofix", lat: null, lng: null });
    const { candidates, rejected } = selectAmbulance([noFix], ORIGIN, NOW);

    expect(candidates).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/no gps position/i);
  });

  it("does not silently prefer an advanced crew over a nearer basic one", () => {
    const nearBasic = amb({ id: "nearBasic", lat: 16.78, lng: 96.16, crew_level: "basic" });
    const farAdvanced = amb({
      id: "farAdvanced", lat: 16.87, lng: 96.19, crew_level: "advanced",
    });

    const { candidates } = selectAmbulance([farAdvanced, nearBasic], ORIGIN, NOW);
    // Crew level is shown to the dispatcher, never scored — overriding on
    // clinical grounds must stay a visible human decision.
    expect(candidates[0].ambulance.id).toBe("nearBasic");
  });

  it("returns nothing dispatchable rather than throwing when the fleet is grounded", () => {
    const grounded = [
      amb({ id: "a", certified: false, device_id: null }),
      amb({ id: "b", status: "offline" }),
    ];
    const { candidates, rejected } = selectAmbulance(grounded, ORIGIN, NOW);

    expect(candidates).toHaveLength(0);
    expect(rejected).toHaveLength(2);
  });

  it("matches the seeded demo fleet: YGN-01 wins, closest vehicle is excluded", () => {
    const fleet = [
      amb({ id: "YGN-01", lat: 16.7801, lng: 96.1571 }),
      amb({ id: "YGN-04", lat: 16.7712, lng: 96.1683 }),
      amb({ id: "YGN-02", lat: 16.7775, lng: 96.1601, status: "transporting" }),
      amb({ id: "YGN-09", lat: 16.7769, lng: 96.1594, certified: false, device_id: null }),
      amb({ id: "YGN-11", lat: 16.865, lng: 96.172 }),
    ];

    const { candidates, rejected } = selectAmbulance(fleet, ORIGIN, NOW);

    expect(candidates[0].ambulance.id).toBe("YGN-01");

    // YGN-09 sits essentially on top of the incident but has no IoT unit, and
    // YGN-02 is metres away but already carrying a patient.
    const rejectedIds = rejected.map((r) => r.ambulance.id);
    expect(rejectedIds).toContain("YGN-09");
    expect(rejectedIds).toContain("YGN-02");
  });
});

describe("geo", () => {
  it("measures a known Yangon distance within a sane range", () => {
    // Downtown → Thingangyun Sanpya, roughly 6 km.
    const km = haversineKm(ORIGIN, { lat: 16.8206, lng: 96.1897 });
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(8);
  });

  it("returns zero distance for the same point", () => {
    expect(haversineKm(ORIGIN, ORIGIN)).toBeCloseTo(0, 6);
  });

  it("converts distance to minutes monotonically", () => {
    expect(etaMinutes(10)).toBeGreaterThan(etaMinutes(5));
  });
});

describe("the demo scenario", () => {
  /** Mirrors the seeded Yangon data — this is what judges will see. */
  const seeded: Hospital[] = [
    hospital({
      id: "Yangon General", lat: 16.7797, lng: 96.15,
      specialties: ["cardiology", "trauma", "neurology", "burns", "general"],
      total_beds: 600, available_beds: 0, icu_beds_free: 0,
      doctors_on_duty: { cardiology: 3 }, er_capacity: 40, current_er_queue: 45,
    }),
    hospital({
      id: "New Yangon", lat: 16.7743, lng: 96.142,
      specialties: ["cardiology", "obstetrics", "general"],
      total_beds: 300, available_beds: 6, icu_beds_free: 0,
      doctors_on_duty: { cardiology: 0 }, er_capacity: 30, current_er_queue: 26,
    }),
    hospital({
      id: "Thingangyun Sanpya", lat: 16.8206, lng: 96.1897,
      specialties: ["cardiology", "neurology", "general"],
      total_beds: 220, available_beds: 22, icu_beds_free: 4,
      doctors_on_duty: { cardiology: 2 }, er_capacity: 28, current_er_queue: 9,
    }),
    hospital({
      id: "North Okkalapa", lat: 16.9086, lng: 96.1706,
      specialties: ["cardiology", "trauma", "general"],
      total_beds: 400, available_beds: 55, icu_beds_free: 6,
      doctors_on_duty: { cardiology: 1 }, er_capacity: 35, current_er_queue: 12,
    }),
    hospital({
      id: "Insein", lat: 16.8944, lng: 96.1053,
      specialties: ["trauma", "orthopaedics", "general"],
      total_beds: 300, available_beds: 30, icu_beds_free: 2,
      doctors_on_duty: { trauma: 3 }, er_capacity: 25, current_er_queue: 8,
    }),
  ];

  const criticalCardiac: Triage = {
    condition: "cardiac",
    severity: "critical",
    requiredSpecialty: "cardiology",
    needsICU: true,
    redFlags: [],
    confidence: 0.9,
  };

  it("picks Thingangyun Sanpya over the two closer hospitals", () => {
    const { ranked, excluded, relaxed } = recommend(seeded, criticalCardiac, ORIGIN);

    expect(relaxed).toBe(false);
    expect(ranked[0].hospital.id).toBe("Thingangyun Sanpya");

    // The whole thesis: the nearest hospital is not the answer.
    const nearest = [...seeded].sort(
      (a, b) => haversineKm(ORIGIN, a) - haversineKm(ORIGIN, b),
    )[0];
    expect(nearest.id).not.toBe(ranked[0].hospital.id);

    const reasons = Object.fromEntries(
      excluded.map((e) => [e.hospital.id, e.reason]),
    );
    expect(reasons["Yangon General"]).toMatch(/no available beds/i);
    expect(reasons["New Yangon"]).toMatch(/specialist on duty/i);
    expect(reasons["Insein"]).toMatch(/no cardiology service/i);
  });

  it("still beats the closer trap hospital at urgent severity, where it is not filtered", () => {
    const { ranked } = recommend(
      seeded,
      { ...criticalCardiac, severity: "urgent", needsICU: false },
      ORIGIN,
    );

    const order = ranked.map((r) => r.hospital.id);
    expect(order[0]).toBe("Thingangyun Sanpya");
    // New Yangon is closer but has no cardiologist — must rank below.
    expect(order.indexOf("New Yangon")).toBeGreaterThan(0);
  });
});

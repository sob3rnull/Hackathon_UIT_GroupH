import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recommend, selectAmbulance } from "./engine";
import type { Ambulance, Hospital, LatLng, Severity, Triage } from "./types";

/**
 * The n8n backend runs the ranking inside a Code node, which means the logic
 * the other 27 tests cover is NOT the logic that actually serves requests.
 * Two copies of the most important algorithm in the project would drift
 * silently, and nobody would notice until a demo produced a different answer
 * from the one rehearsed.
 *
 * This suite loads the exact file embedded in that Code node and asserts it
 * agrees with the TypeScript engine, case for case. If you change one and not
 * the other, this fails.
 */

const CORE_PATH = join(process.cwd(), "n8n", "ranking-core.js");

interface Core {
  recommend: typeof recommend;
  selectAmbulance: (
    ambulances: Ambulance[],
    incident: LatLng,
    nowMs: number,
  ) => ReturnType<typeof selectAmbulance>;
}

/**
 * The core file is function declarations only — no imports, no exports, no
 * top-level statements — precisely so it can be evaluated like this AND
 * pasted into the sandbox unchanged.
 */
function loadCore(): Core {
  const source = readFileSync(CORE_PATH, "utf8");
  const factory = new Function(
    `${source}\nreturn { recommend: recommend, selectAmbulance: selectAmbulance };`,
  );
  return factory() as Core;
}

const core = loadCore();
const ORIGIN: LatLng = { lat: 16.7769, lng: 96.1592 };
const NOW = new Date("2026-07-22T10:00:00Z");

function hospital(over: Partial<Hospital> & { id: string }): Hospital {
  return {
    name: over.id,
    short_name: over.id,
    lat: 16.79,
    lng: 96.16,
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

function amb(over: Partial<Ambulance> & { id: string }): Ambulance {
  return {
    callsign: over.id,
    operator: "Test EMS",
    device_id: "IOT-0000",
    certified: true,
    lat: 16.78,
    lng: 96.16,
    gps_fix_at: new Date(NOW.getTime() - 60_000).toISOString(),
    status: "available",
    crew_level: "basic",
    updated_at: NOW.toISOString(),
    ...over,
  };
}

/** Deliberately awkward inputs — the edge cases are where copies diverge. */
const HOSPITAL_CASES: Hospital[][] = [
  [
    hospital({ id: "full", available_beds: 0 }),
    hospital({ id: "noSpecialist", doctors_on_duty: { cardiology: 0 } }),
    hospital({ id: "good", lat: 16.82, lng: 96.19, icu_beds_free: 4 }),
    hospital({ id: "wrongService", specialties: ["orthopaedics"] }),
  ],
  [hospital({ id: "onlyOne" })],
  [hospital({ id: "zeroBedTotal", total_beds: 0, available_beds: 1 })],
  [hospital({ id: "overCapacity", current_er_queue: 90, er_capacity: 30 })],
  [hospital({ id: "veryFar", lat: 19.5, lng: 96.16 })],
  [],
];

const SEVERITIES: Severity[] = ["critical", "urgent", "stable"];

const AMBULANCE_CASES: Ambulance[][] = [
  [
    amb({ id: "near" }),
    amb({ id: "far", lat: 16.9, lng: 96.2 }),
    amb({ id: "uncertified", certified: false, device_id: null }),
    amb({ id: "busy", status: "transporting" }),
    amb({
      id: "stale",
      gps_fix_at: new Date(NOW.getTime() - 45 * 60_000).toISOString(),
    }),
    amb({ id: "noFix", lat: null, lng: null }),
    amb({ id: "noTimestamp", gps_fix_at: null }),
  ],
  [amb({ id: "solo" })],
  [],
];

describe("n8n Code node matches the TypeScript engine", () => {
  it.each(SEVERITIES)("hospital ranking agrees at %s severity", (severity) => {
    for (const [index, hospitals] of HOSPITAL_CASES.entries()) {
      for (const needsICU of [true, false]) {
        const triage: Triage = {
          condition: "cardiac",
          severity,
          requiredSpecialty: "cardiology",
          needsICU,
          redFlags: [],
          confidence: 1,
        };

        const ts = recommend(hospitals, triage, ORIGIN);
        const js = core.recommend(hospitals, triage, ORIGIN);
        const label = `case ${index}, severity ${severity}, ICU ${needsICU}`;

        expect(js.relaxed, label).toBe(ts.relaxed);
        expect(js.ranked.map((r) => r.hospital.id), label).toEqual(
          ts.ranked.map((r) => r.hospital.id),
        );
        expect(js.excluded.map((e) => e.reason), label).toEqual(
          ts.excluded.map((e) => e.reason),
        );

        js.ranked.forEach((entry, i) => {
          expect(entry.score, `${label} score`).toBeCloseTo(ts.ranked[i].score, 12);
          expect(entry.reasons, `${label} reasons`).toEqual(ts.ranked[i].reasons);
          expect(entry.parts, `${label} parts`).toEqual(ts.ranked[i].parts);
        });
      }
    }
  });

  it("ambulance selection agrees, including rejection reasons", () => {
    for (const [index, fleet] of AMBULANCE_CASES.entries()) {
      const ts = selectAmbulance(fleet, ORIGIN, NOW);
      const js = core.selectAmbulance(fleet, ORIGIN, NOW.getTime());
      const label = `fleet case ${index}`;

      expect(js.candidates.map((c) => c.ambulance.id), label).toEqual(
        ts.candidates.map((c) => c.ambulance.id),
      );
      expect(js.rejected.map((r) => r.ambulance.id), label).toEqual(
        ts.rejected.map((r) => r.ambulance.id),
      );
      // Reasons are shown verbatim to the dispatcher — they must match too.
      expect(js.rejected.map((r) => r.reason), label).toEqual(
        ts.rejected.map((r) => r.reason),
      );

      js.candidates.forEach((candidate, i) => {
        expect(candidate.responseMinutes, label).toBeCloseTo(
          ts.candidates[i].responseMinutes,
          12,
        );
      });
    }
  });

  it("the core file stays sandbox-safe: no imports, exports, or network calls", () => {
    const source = readFileSync(CORE_PATH, "utf8");
    // The n8n Code sandbox blocks all of these at runtime, and an import would
    // also break the new Function() evaluation above.
    expect(source).not.toMatch(/^\s*(import|export)\s/m);
    expect(source).not.toMatch(/\b(fetch|axios|require|XMLHttpRequest)\s*\(/);
  });
});

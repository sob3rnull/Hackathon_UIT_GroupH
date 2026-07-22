import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createDataClient } from "@/lib/supabase/server";
import type { Ambulance, AmbulanceStatus, Donation, Hospital } from "./types";

/** Powers the "Demo data" / "Supabase" badge in the header. */
export function storeMode(): "supabase" | "memory" {
  return isSupabaseConfigured ? "supabase" : "memory";
}

/**
 * The only module that touches storage for MediRoute.
 *
 * With Supabase env vars set it reads and writes Postgres; with them blank it
 * runs the same data in memory. The demo therefore survives a dead database,
 * losing only live cross-device sync.
 */

const HOSPITAL_COLUMNS =
  "id, name, short_name, description, lat, lng, specialties, total_beds, available_beds, icu_beds_free, doctors_on_duty, er_capacity, current_er_queue, updated_at";

/** Downtown Yangon, near Sule Pagoda. Default incident location. */
export const DEFAULT_ORIGIN = { lat: 16.7769, lng: 96.1592 };

/* ── In-memory mirror of the seeded table ──────────────────────────────── */

const g = globalThis as unknown as { __hospitals?: Hospital[] };

function seedHospitals(): Hospital[] {
  const now = new Date().toISOString();
  const make = (
    id: string,
    name: string,
    short_name: string,
    description: string,
    lat: number,
    lng: number,
    specialties: string[],
    total_beds: number,
    available_beds: number,
    icu_beds_free: number,
    doctors_on_duty: Record<string, number>,
    er_capacity: number,
    current_er_queue: number,
  ): Hospital => ({
    id,
    name,
    short_name,
    description,
    lat,
    lng,
    specialties,
    total_beds,
    available_beds,
    icu_beds_free,
    doctors_on_duty,
    er_capacity,
    current_er_queue,
    updated_at: now,
  });

  return [
    make("mem-1", "Yangon General Hospital", "Yangon General",
      "The country's largest teaching hospital and the main tertiary referral centre for trauma, cardiac and burn cases.",
      16.7797, 96.15,
      ["cardiology", "trauma", "neurology", "burns", "general"],
      600, 0, 0, { cardiology: 3, trauma: 2, neurology: 1, general: 6 }, 40, 45),
    make("mem-2", "New Yangon General Hospital", "New Yangon",
      "A downtown general hospital with strong cardiology and obstetric services, taking pressure off Yangon General.",
      16.7743, 96.142,
      ["cardiology", "obstetrics", "general"],
      300, 6, 0, { cardiology: 0, obstetrics: 1, general: 2 }, 30, 26),
    make("mem-3", "Yangon Children's Hospital", "Children's",
      "Myanmar's specialist paediatric referral hospital, caring for newborns and children and handling obstetric emergencies.",
      16.7856, 96.1436,
      ["paediatrics", "obstetrics", "general"],
      250, 40, 3, { paediatrics: 3, obstetrics: 2, general: 4 }, 20, 5),
    make("mem-4", "Thingangyun Sanpya General Hospital", "Thingangyun Sanpya",
      "A general hospital in eastern Yangon known for its cardiology and stroke response teams.",
      16.8206, 96.1897,
      ["cardiology", "neurology", "general"],
      220, 22, 4, { cardiology: 2, neurology: 1, general: 3 }, 28, 9),
    make("mem-5", "North Okkalapa General Hospital", "North Okkalapa",
      "A busy general and teaching hospital serving Yangon's densely populated northern townships.",
      16.9086, 96.1706,
      ["cardiology", "trauma", "general"],
      400, 55, 6, { cardiology: 1, trauma: 2, general: 5 }, 35, 12),
    make("mem-6", "Insein General Hospital", "Insein",
      "The main public hospital for north-western Yangon, with round-the-clock trauma and orthopaedic surgery.",
      16.8944, 96.1053,
      ["trauma", "orthopaedics", "general"],
      300, 30, 2, { trauma: 3, orthopaedics: 1, general: 4 }, 25, 8),
  ];
}

function memory(): Hospital[] {
  g.__hospitals ??= seedHospitals();
  return g.__hospitals;
}

/* ── Hospitals ─────────────────────────────────────────────────────────── */

export async function listHospitals(): Promise<Hospital[]> {
  const db = await createDataClient();
  if (!db) return [...memory()];

  const { data, error } = await db
    .from("hospitals")
    .select(HOSPITAL_COLUMNS)
    .order("short_name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Hospital[];
}

export type CapacityPatch = Partial<
  Pick<
    Hospital,
    "available_beds" | "icu_beds_free" | "current_er_queue" | "doctors_on_duty"
  >
>;

export async function updateHospital(
  id: string,
  patch: CapacityPatch,
): Promise<Hospital> {
  const db = await createDataClient();

  if (!db) {
    const rows = memory();
    const index = rows.findIndex((h) => h.id === id);
    if (index === -1) throw new Error("Hospital not found");
    rows[index] = { ...rows[index], ...patch, updated_at: new Date().toISOString() };
    return rows[index];
  }

  const { data, error } = await db
    .from("hospitals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(HOSPITAL_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as Hospital;
}

/* ── Ambulance fleet ───────────────────────────────────────────────────── */

const AMBULANCE_COLUMNS =
  "id, callsign, operator, device_id, certified, lat, lng, gps_fix_at, status, crew_level, updated_at";

const ga = globalThis as unknown as { __ambulances?: Ambulance[] };

function seedAmbulances(): Ambulance[] {
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const make = (
    id: string,
    callsign: string,
    operator: string,
    device_id: string | null,
    certified: boolean,
    lat: number | null,
    lng: number | null,
    gps_fix_at: string | null,
    status: AmbulanceStatus,
    crew_level: "basic" | "advanced",
  ): Ambulance => ({
    id, callsign, operator, device_id, certified, lat, lng,
    gps_fix_at, status, crew_level, updated_at: now,
  });

  return [
    make("amb-1", "YGN-01", "Yangon City EMS", "IOT-8841", true, 16.7801, 96.1571, now, "available", "advanced"),
    make("amb-2", "YGN-04", "Yangon City EMS", "IOT-8844", true, 16.7712, 96.1683, now, "available", "basic"),
    make("amb-3", "YGN-02", "Yangon City EMS", "IOT-8842", true, 16.7775, 96.1601, now, "transporting", "advanced"),
    make("amb-4", "YGN-09", "Private operator", null, false, 16.7769, 96.1594, null, "available", "basic"),
    make("amb-5", "YGN-06", "Yangon City EMS", "IOT-8846", true, 16.81, 96.15, stale, "offline", "basic"),
    make("amb-6", "YGN-11", "North District EMS", "IOT-8851", true, 16.865, 96.172, now, "available", "advanced"),
  ];
}

function ambulanceMemory(): Ambulance[] {
  ga.__ambulances ??= seedAmbulances();
  return ga.__ambulances;
}

export async function listAmbulances(): Promise<Ambulance[]> {
  const db = await createDataClient();
  if (!db) return [...ambulanceMemory()];

  const { data, error } = await db
    .from("ambulances")
    .select(AMBULANCE_COLUMNS)
    .order("callsign");

  if (error) throw new Error(error.message);
  return (data ?? []) as Ambulance[];
}

export type AmbulancePatch = Partial<
  Pick<Ambulance, "status" | "lat" | "lng" | "certified"> & { gps_fix_at: string }
>;

export async function updateAmbulance(
  id: string,
  patch: AmbulancePatch,
): Promise<Ambulance> {
  const db = await createDataClient();

  if (!db) {
    const rows = ambulanceMemory();
    const index = rows.findIndex((a) => a.id === id);
    if (index === -1) throw new Error("Ambulance not found");
    rows[index] = { ...rows[index], ...patch, updated_at: new Date().toISOString() };
    return rows[index];
  }

  const { data, error } = await db
    .from("ambulances")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(AMBULANCE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as Ambulance;
}

/* ── Dispatches ────────────────────────────────────────────────────────── */

export interface DispatchInput {
  /**
   * Null at creation: the dispatcher's job now ends at assigning a vehicle.
   * The destination is filled in later by chooseDispatchHospital(), once the
   * crew picks it from their tablet.
   */
  hospital_id: string | null;
  recommended_hospital_id: string | null;
  ambulance_id: string | null;
  patient_note: string;
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  /** Transport leg: incident → hospital. */
  eta_minutes: number;
  /** Response leg: ambulance → incident. */
  response_eta_minutes: number;
  incident_lat: number | null;
  incident_lng: number | null;
  /** How the paramedic note was captured — "text" or "voice". */
  input_mode: string;
  was_override: boolean;
}

export interface DispatchRow extends DispatchInput {
  id: string;
  created_at: string;
}

const gd = globalThis as unknown as { __dispatches?: DispatchRow[] };
function dispatchMemory(): DispatchRow[] {
  gd.__dispatches ??= [];
  return gd.__dispatches;
}

export async function createDispatch(input: DispatchInput): Promise<DispatchRow> {
  const db = await createDataClient();

  if (!db) {
    const row: DispatchRow = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    dispatchMemory().unshift(row);
    return row;
  }

  const { data, error } = await db
    .from("dispatches")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as DispatchRow;
}

/**
 * What the crew fills in that the dispatcher's assign-time write couldn't
 * know: the actual triage (run on their own screen, not the dispatcher's)
 * and, once ranked against it, the hospital they're taking the patient to.
 * One write, since both happen in the same sitting.
 */
export type DispatchConfirmPatch = Pick<
  DispatchRow,
  | "patient_note"
  | "condition"
  | "severity"
  | "required_specialty"
  | "needs_icu"
  | "hospital_id"
  | "recommended_hospital_id"
  | "eta_minutes"
  | "was_override"
>;

/** The crew's confirmation, applied once — on top of the row assignAmbulance created. */
export async function updateDispatch(
  id: string,
  patch: DispatchConfirmPatch,
): Promise<DispatchRow> {
  const db = await createDataClient();

  if (!db) {
    const rows = dispatchMemory();
    const index = rows.findIndex((d) => d.id === id);
    if (index === -1) throw new Error("Dispatch not found");
    rows[index] = { ...rows[index], ...patch };
    return rows[index];
  }

  const { data, error } = await db
    .from("dispatches")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as DispatchRow;
}

/* ── Donations ─────────────────────────────────────────────────────────── */

const gdn = globalThis as unknown as { __donations?: Donation[] };

/** A couple of seed rows so the public page has totals to show on day one. */
function seedDonations(): Donation[] {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return [
    { id: "don-1", hospital_id: "mem-1", donor_name: "Daw Khin Myo", amount: 150000, message: "For the ER team.", created_at: hourAgo },
    { id: "don-2", hospital_id: "mem-3", donor_name: "U Aung Ko", amount: 80000, message: "", created_at: dayAgo },
    { id: "don-3", hospital_id: "mem-1", donor_name: "Anonymous", amount: 50000, message: "Keep going!", created_at: dayAgo },
  ];
}

function donationMemory(): Donation[] {
  gdn.__donations ??= seedDonations();
  return gdn.__donations;
}

export interface DonationInput {
  hospital_id: string | null;
  donor_name: string;
  amount: number;
  message: string;
}

export async function createDonation(input: DonationInput): Promise<Donation> {
  const db = await createDataClient();

  if (!db) {
    const row: Donation = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    donationMemory().unshift(row);
    return row;
  }

  const { data, error } = await db
    .from("donations")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Donation;
}

export async function listDonations(): Promise<Donation[]> {
  const db = await createDataClient();
  if (!db) return [...donationMemory()];

  const { data, error } = await db
    .from("donations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as Donation[];
}

export async function donationTotals(): Promise<
  Record<string, { total: number; count: number }>
> {
  const db = await createDataClient();

  // Memory mode reuses the full list; Supabase fetches the two columns it
  // needs without the recency limit so totals stay correct as rows grow.
  let rows: Pick<Donation, "hospital_id" | "amount">[];
  if (!db) {
    rows = donationMemory();
  } else {
    const { data, error } = await db.from("donations").select("hospital_id, amount");
    if (error) throw new Error(error.message);
    rows = (data ?? []) as Pick<Donation, "hospital_id" | "amount">[];
  }

  const totals: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    if (!row.hospital_id) continue;
    const entry = (totals[row.hospital_id] ??= { total: 0, count: 0 });
    entry.total += Number(row.amount);
    entry.count += 1;
  }
  return totals;
}

export async function listDispatches(): Promise<DispatchRow[]> {
  const db = await createDataClient();
  if (!db) return [...dispatchMemory()];

  const { data, error } = await db
    .from("dispatches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as DispatchRow[];
}

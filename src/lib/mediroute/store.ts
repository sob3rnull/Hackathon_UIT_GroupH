import "server-only";

import { createDataClient } from "@/lib/supabase/server";
import type { Hospital } from "./types";

/**
 * The only module that touches storage for MediRoute.
 *
 * With Supabase env vars set it reads and writes Postgres; with them blank it
 * runs the same data in memory. The demo therefore survives a dead database,
 * losing only live cross-device sync.
 */

const HOSPITAL_COLUMNS =
  "id, name, short_name, lat, lng, specialties, total_beds, available_beds, icu_beds_free, doctors_on_duty, er_capacity, current_er_queue, updated_at";

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
    make("mem-1", "Yangon General Hospital", "Yangon General", 16.7797, 96.15,
      ["cardiology", "trauma", "neurology", "burns", "general"],
      600, 0, 0, { cardiology: 3, trauma: 2, neurology: 1, general: 6 }, 40, 45),
    make("mem-2", "New Yangon General Hospital", "New Yangon", 16.7743, 96.142,
      ["cardiology", "obstetrics", "general"],
      300, 6, 0, { cardiology: 0, obstetrics: 1, general: 2 }, 30, 26),
    make("mem-3", "Yangon Children's Hospital", "Children's", 16.7856, 96.1436,
      ["paediatrics", "obstetrics", "general"],
      250, 40, 3, { paediatrics: 3, obstetrics: 2, general: 4 }, 20, 5),
    make("mem-4", "Thingangyun Sanpya General Hospital", "Thingangyun Sanpya", 16.8206, 96.1897,
      ["cardiology", "neurology", "general"],
      220, 22, 4, { cardiology: 2, neurology: 1, general: 3 }, 28, 9),
    make("mem-5", "North Okkalapa General Hospital", "North Okkalapa", 16.9086, 96.1706,
      ["cardiology", "trauma", "general"],
      400, 55, 6, { cardiology: 1, trauma: 2, general: 5 }, 35, 12),
    make("mem-6", "Insein General Hospital", "Insein", 16.8944, 96.1053,
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
  const db = createDataClient();
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
  const db = createDataClient();

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

/* ── Dispatches ────────────────────────────────────────────────────────── */

export interface DispatchInput {
  hospital_id: string;
  recommended_hospital_id: string | null;
  patient_note: string;
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  eta_minutes: number;
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
  const db = createDataClient();

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

export async function listDispatches(): Promise<DispatchRow[]> {
  const db = createDataClient();
  if (!db) return [...dispatchMemory()];

  const { data, error } = await db
    .from("dispatches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as DispatchRow[];
}

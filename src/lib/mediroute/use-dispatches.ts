"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "./types";

/** Mirrors the row shape returned by GET /api/dispatch. */
export interface DispatchRecord {
  id: string;
  hospital_id: string | null;
  recommended_hospital_id: string | null;
  ambulance_id: string | null;
  patient_note: string;
  condition: string;
  severity: string;
  required_specialty: string;
  needs_icu: boolean;
  eta_minutes: number;
  response_eta_minutes: number;
  incident_lat: number | null;
  incident_lng: number | null;
  input_mode: string;
  was_override: boolean;
  created_at: string;
  status: string;
  accepted_at: string | null;
  arrived_at: string | null;
}

interface DispatchFeed {
  dispatches: DispatchRecord[];
  total: number;
  overrides: number;
  /**
   * Agreement, not "accuracy" — there is no ground truth about which hospital
   * was actually correct, only whether the human concurred. Named the same way
   * the API names it, so the wording can't drift between the two.
   */
  agreementRate: number | null;
}

const EMPTY: DispatchFeed = {
  dispatches: [],
  total: 0,
  overrides: 0,
  agreementRate: null,
};

/**
 * Past incidents. Polled rather than subscribed: history is read after the
 * fact, so a 10s refresh is plenty and it keeps the realtime channel budget
 * for the two feeds that drive live routing.
 */
export function useDispatches() {
  const [feed, setFeed] = useState<DispatchFeed>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A slow Supabase round trip has been observed taking longer than the poll
  // interval. Without this guard the ticks would stack up behind it and each
  // one would land out of order.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/dispatch");
      const result: ApiResult<DispatchFeed> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setFeed(result.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load history");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() is async — setState runs after the fetch resolves, not here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  return { ...feed, loading, error, reload: load };
}

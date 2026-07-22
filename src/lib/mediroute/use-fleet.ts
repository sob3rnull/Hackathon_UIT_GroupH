"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ambulance, ApiResult } from "./types";

/**
 * Live ambulance fleet, mirroring useHospitals.
 *
 * In production the position updates arrive from each vehicle's on-board IoT
 * unit posting to /api/ambulances/[id]; the browser just subscribes to the
 * resulting table changes. For the demo the fleet panel plays the part of the
 * devices.
 */
export function useFleet() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [revision, setRevision] = useState(0);
  const firstLoad = useRef(true);

  const load = useCallback(async (markRevision = false) => {
    try {
      const response = await fetch("/api/ambulances");
      const result: ApiResult<Ambulance[]> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setAmbulances(result.data);
      setError(null);
      if (markRevision && !firstLoad.current) setRevision((r) => r + 1);
      firstLoad.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load fleet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() is async — setState runs after the fetch resolves, not here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    const supabase = createClient();
    if (!supabase) {
      const timer = setInterval(() => void load(true), 4000);
      return () => clearInterval(timer);
    }

    const channel = supabase
      .channel("ambulance-fleet")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ambulances" },
        () => void load(true),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { ambulances, loading, error, live, revision, reload: load };
}

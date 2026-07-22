"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ApiResult, Hospital } from "./types";

/**
 * Live hospital capacity.
 *
 * Prefers Supabase Realtime — Postgres change events over a websocket, which
 * is what makes the dispatcher view re-rank the instant a staff member frees a
 * bed on another machine. That replaces the Socket.io server the original
 * outline called for: there is no socket server to write.
 *
 * When Supabase isn't configured it degrades to polling, so the same component
 * works against the in-memory store.
 */
export function useHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  /** Bumps on every external capacity change — used to flag "data changed". */
  const [revision, setRevision] = useState(0);
  const firstLoad = useRef(true);

  const load = useCallback(async (markRevision = false) => {
    try {
      const response = await fetch("/api/hospitals");
      const result: ApiResult<Hospital[]> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setHospitals(result.data);
      setError(null);
      if (markRevision && !firstLoad.current) setRevision((r) => r + 1);
      firstLoad.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() is async — every setState inside it runs after the fetch
    // resolves, not synchronously here. Fetch-on-mount, no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    const supabase = createClient();

    if (!supabase) {
      // No realtime available — poll instead so the demo still updates.
      const timer = setInterval(() => void load(true), 4000);
      return () => clearInterval(timer);
    }

    const channel = supabase
      .channel("hospital-capacity")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hospitals" },
        () => void load(true),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { hospitals, loading, error, live, revision, reload: load };
}

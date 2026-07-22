"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ApiResult, DonationSummary } from "./types";

/**
 * Donation totals for the public page. Same shape as useHospitals: Supabase
 * Realtime when configured, gentle polling against the in-memory store when
 * not, so the directory works either way.
 */
export function useDonations() {
  const [summary, setSummary] = useState<DonationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/donations");
      const result: ApiResult<DonationSummary> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setSummary(result.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load donations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() is async — every setState inside it runs after the fetch
    // resolves, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    const supabase = createClient();

    if (!supabase) {
      const timer = setInterval(() => void load(), 10000);
      return () => clearInterval(timer);
    }

    const channel = supabase
      .channel("donations-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { summary, loading, error, reload: load };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResult, DonationSummary } from "./types";

/**
 * Donation totals for the public page. Polls every 10s regardless of whether
 * Supabase is configured — see the note in the effect for why this one hook
 * doesn't use Realtime the way useHospitals and useFleet do.
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

    // Polling, not Realtime, and deliberately so. Realtime broadcasts the full
    // row to subscribers and ignores column-level grants, so subscribing to
    // `donations` would push every donor's payer_phone to the browser even
    // though the REST path is locked down. Migration 0007 drops the table from
    // the publication; a 10s poll is the honest trade for a donation counter.
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  return { summary, loading, error, reload: load };
}

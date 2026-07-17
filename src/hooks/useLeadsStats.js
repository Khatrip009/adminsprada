// src/hooks/useLeadsStats.js
import { useEffect, useState, useCallback } from "react";
import { getLeadsStats } from "../lib/api";

export default function useLeadsStats({ auto = true, pollIntervalMs = 0 } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(Boolean(auto));
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // getLeadsStats now returns { total, today, week, month } directly
      const res = await getLeadsStats();
      setStats(res || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    fetchStats();
    let t = null;
    if (pollIntervalMs && pollIntervalMs > 0) {
      t = setInterval(fetchStats, pollIntervalMs);
    }
    return () => { if (t) clearInterval(t); };
  }, [auto, fetchStats, pollIntervalMs]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats
  };
}
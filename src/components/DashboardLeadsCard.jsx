// src/components/DashboardLeadsCard.jsx
import React, { useEffect, useState } from "react";
import { getLeadsStats, getLeads } from "../lib/api";
import MetricCard from "./MetricCard";
import toast from "react-hot-toast";

/**
 * Small dashboard card that fetches leads stats and shows a tiny recent list.
 * Place inside DashboardPage's metrics grid (e.g. alongside MetricCard components).
 */
export default function DashboardLeadsCard({ max = 3 }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getLeadsStats();
        if (!mounted) return;
        setStats(s || {});
      } catch (err) {
        console.warn("getLeadsStats", err);
      }

      try {
        const r = await getLeads({ page: 1, limit: max });
        const items = r?.leads || r?.items || r || [];
        if (!mounted) return;
        setRecent(Array.isArray(items) ? items.slice(0, max) : []);
      } catch (err) {
        console.warn("getLeads", err);
        toast.error("Failed loading leads summary");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [max]);

  const total = stats?.total ?? (stats?.all ?? 0);
  const today = stats?.today ?? stats?.new_today ?? 0;

  return (
    <div className="space-y-4">
      <MetricCard
        title="Leads"
        value={total}
        delta={today ? `+${today} today` : "0 today"}
        icon="📩"
      />

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Latest leads</div>
        </div>

        {loading ? <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded" />
        </div> : (
          recent.length === 0 ? <div className="text-sm text-slate-500">No recent leads</div> :
          <div className="space-y-2">
            {recent.map(r => (
              <div key={r.id} className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{r.name || r.email}</div>
                  <div className="text-xs text-slate-500">{r.email || r.phone}</div>
                </div>
                <div className="text-xs text-slate-400">{new Date(r.created_at || Date.now()).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// src/components/charts/ReviewsDonut.jsx
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";

/**
 * Robust ReviewsDonut:
 * - Accepts `distribution` prop OR auto-fetches /api/reviews/stats
 * - Uses numeric height for ResponsiveContainer to avoid -1 width/height warnings
 * - Shows loading / error / empty states and logs data for debugging
 */

const COLORS = ["#BB7521", "#1A6560", "#1B3937", "#F7D8B4", "#E6A85A"];

export default function ReviewsDonut({ distribution: initialDistribution = null, fetchIfMissing = true }) {
  const [distribution, setDistribution] = useState(initialDistribution);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // if parent provided distribution, use it and skip fetch
    if (initialDistribution) {
      setDistribution(initialDistribution);
      return;
    }
    if (!fetchIfMissing) return;

    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/reviews/stats", { credentials: "same-origin" });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status} ${resp.statusText} ${txt}`);
        }
        const data = await resp.json();
        if (!canceled) {
          setDistribution(data);
          // helpful debug log — remove in production
          console.debug("[ReviewsDonut] fetched distribution:", data);
        }
      } catch (err) {
        console.error("[ReviewsDonut] fetch error:", err);
        if (!canceled) {
          setError(err.message || String(err));
          toast.error("Failed to load review stats");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [initialDistribution, fetchIfMissing]);

  // tolerate a few shapes
  const countsSrc = (distribution && (distribution.counts || distribution.counts === undefined && distribution)) || {};
  const safeCounts = {
    "5": Number(countsSrc["5"] || countsSrc[5] || 0),
    "4": Number(countsSrc["4"] || countsSrc[4] || 0),
    "3": Number(countsSrc["3"] || countsSrc[3] || 0),
    "2": Number(countsSrc["2"] || countsSrc[2] || 0),
    "1": Number(countsSrc["1"] || countsSrc[1] || 0),
  };

  const total = distribution && (distribution.total ?? Object.values(safeCounts).reduce((s, v) => s + v, 0)) || 0;
  const avg = distribution && (distribution.avg_rating ?? distribution.avg ?? null);

  const data = [5, 4, 3, 2, 1].map((k, i) => ({ name: `${k}★`, value: safeCounts[String(k)] || 0 }));
  const hasAny = data.some(d => d.value > 0);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="mb-2">
        <div className="text-sm text-sprada3">Reviews distribution</div>
        <div className="text-lg font-bold text-sprada2">Ratings</div>
      </div>

      {/* IMPORTANT: give ResponsiveContainer a numeric height to avoid "width(-1)/height(-1)" warnings */}
      <div style={{ width: "100%", height: 240 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-sprada2/60">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-600">{error}</div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center h-full text-sprada2/60">
            <div className="text-sm">No reviews yet</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} isAnimationActive>
                {data.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, "reviews"]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-sprada2/70">Avg: <span className="font-medium">{avg ?? "0.0"}</span></div>
        <div className="text-xs text-sprada2/70">{total} review{total === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}

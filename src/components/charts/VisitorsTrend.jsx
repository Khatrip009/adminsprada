import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function VisitorsTrend({ data = [] }) {
  // fallback sample
  if (!data || data.length === 0) {
    const now = new Date();
    data = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return { date: d.toLocaleDateString(), visitors: Math.floor(500 + Math.random() * 800) };
    });
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm text-sprada3">Visitors (7 days)</div>
          <div className="text-lg font-bold text-sprada2">Trend</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A6560" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1A6560" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1"/>
            <XAxis dataKey="date" tick={{ fill: "#6b6b6b" }} />
            <YAxis tick={{ fill: "#6b6b6b" }} />
            <Tooltip />
            <Area type="monotone" dataKey="visitors" stroke="#1A6560" fill="url(#vgrad)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

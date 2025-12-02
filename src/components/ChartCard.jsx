// src/components/ChartCard.jsx
import React from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

const sample = [
  { name: "Jan", uv: 4000 },
  { name: "Feb", uv: 3000 },
  { name: "Mar", uv: 5000 },
  { name: "Apr", uv: 4000 },
  { name: "May", uv: 6000 },
  { name: "Jun", uv: 7000 },
]

export default function ChartCard({ title = "Traffic", data = sample }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-sprada3 font-medium">{title}</div>
          <div className="text-lg font-bold text-sprada2">Monthly overview</div>
        </div>
      </div>

      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A6560" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#1A6560" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
            <XAxis dataKey="name" tick={{ fill: "#6b6b6b" }} />
            <YAxis tick={{ fill: "#6b6b6b" }} />
            <Tooltip />
            <Area type="monotone" dataKey="uv" stroke="#1A6560" strokeWidth={2} fill="url(#colorUv)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

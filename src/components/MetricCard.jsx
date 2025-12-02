// src/components/MetricCard.jsx
import React from "react"

export default function MetricCard({ title, value, delta, icon, className = "" }) {
  const positive = typeof delta === "string" ? delta.startsWith("+") : delta >= 0
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-sprada3 font-medium">{title}</div>
          <div className="text-2xl font-bold text-sprada2 mt-1">{value}</div>
        </div>
        <div className="text-2xl text-sprada4/90">{icon}</div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <div className={`px-2 py-1 rounded-md ${positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {delta}
        </div>
        <div className="text-xs text-sprada2/60">vs last period</div>
      </div>
    </div>
  )
}

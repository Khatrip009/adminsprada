// src/components/MetricCardLeads.jsx
import React from "react";
import { Users } from "lucide-react";

export default function MetricCardLeads({
  title,
  value,
  delta,
  icon = <Users className="w-6 h-6" />,
  className = "",
}) {
  // safe delta fallback
  const safeDelta = delta ?? "+0";

  const positive =
    typeof safeDelta === "string"
      ? safeDelta.startsWith("+")
      : Number(safeDelta) >= 0;

  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-sprada3 font-medium">{title}</div>
          <div className="text-2xl font-bold text-sprada2 mt-1">{value}</div>
        </div>

        <div className="text-sprada4/90">{icon}</div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <div
          className={`px-2 py-1 rounded-md ${
            positive
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {safeDelta}
        </div>
        <div className="text-xs text-sprada2/60">vs last period</div>
      </div>
    </div>
  );
}

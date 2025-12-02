import React from "react";

export default function PushList({ items = [] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="mb-3"><div className="text-sm text-sprada3">Push Subscriptions</div><div className="text-lg font-bold text-sprada2">Active</div></div>
      <ul className="space-y-2 text-sm">
        {items.map(s => (
          <li key={s.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-sprada1/20 flex items-center justify-center text-sprada4">🔔</div>
            <div className="flex-1">
              <div className="font-medium">{s.browser || "Subscription"}</div>
              <div className="text-xs text-sprada2/60">{new Date(s.created_at).toLocaleString()}</div>
            </div>
          </li>
        ))}
        {items.length === 0 && <div className="text-sm text-sprada2/60">No subscriptions</div>}
      </ul>
    </div>
  );
}

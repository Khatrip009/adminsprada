import React from "react";

export default function VisitorSessions({ items = [] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="mb-3"><div className="text-sm text-sprada3">Visitor Sessions</div><div className="text-lg font-bold text-sprada2">Recent sessions</div></div>
      <div className="space-y-2 text-sm">
        {items.map(s => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-gradient-to-br from-sprada3 to-sprada2 flex items-center justify-center text-white">V</div>
            <div className="flex-1">
              <div className="font-medium text-sprada2">{s.visitor_id || s.session_id || s.id}</div>
              <div className="text-xs text-sprada2/60">{s.browser || s.ip || ''} • {s.last_ping ? new Date(s.last_ping).toLocaleString() : ''}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-sprada2/60">No sessions</div>}
      </div>
    </div>
  );
}

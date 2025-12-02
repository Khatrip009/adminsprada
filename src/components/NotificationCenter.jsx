import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { getPushSubscriptions } from "../lib/api";

export default function NotificationCenter({ onClose }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await getPushSubscriptions();
        setItems(r.subscriptions || []);
      } catch (err) {
        console.error("load push subs", err);
      }
    })();
  }, []);

  return (
    <div className="absolute right-0 mt-2 w-[380px] bg-white rounded-xl shadow-lg border border-slate-100 z-30 overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="font-semibold text-sprada2">Notifications</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><FiX /></button>
      </div>

      <div className="max-h-72 overflow-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-sprada2/70">No notifications yet.</div>
        ) : items.map((s) => (
          <div key={s.id} className="p-3 border-b last:border-b-0 flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-sprada1/30 flex items-center justify-center text-sprada4">🔔</div>
            <div className="flex-1 text-sm text-sprada2">
              <div className="font-medium">{s.browser || 'Subscription'}</div>
              <div className="text-xs text-sprada2/60">{new Date(s.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t text-sm text-center text-sprada2/60">Manage push subscriptions in admin</div>
    </div>
  );
}

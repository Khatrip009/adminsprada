// src/ui/ToastProvider.jsx
import React, { createContext, useContext, useCallback, useState } from "react";

/**
 * Minimal toast provider to avoid HMR issues when your other toast lib
 * may not be stable in dev. Usage:
 *
 * const toast = useToast();
 * toast("Message", { type: "success" });
 */

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext) || (() => {});
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, opts = {}) => {
    const id = `t_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setToasts((s) => [...s, { id, message, ...opts }]);
    const ms = typeof opts.duration === "number" ? opts.duration : 3500;
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, ms);
    return id;
  }, []);

  const hide = useCallback((id) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {/* basic toast visuals (can be replaced with Radix later) */}
      <div aria-live="polite" className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="min-w-[220px] max-w-sm bg-white shadow-lg border rounded p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 text-slate-900">{t.message}</div>
              <button onClick={() => hide(t.id)} className="text-xs text-slate-500 ml-2">✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;

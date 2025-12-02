// src/components/layout/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiBarChart2,
  FiUsers,
  FiBox,
  FiFileText,
  FiBell,
  FiMenu,
  FiChevronLeft
} from "react-icons/fi";
import clsx from "clsx";
import { apiGet } from "../lib/api"; // adjust only if your project structure differs

export default function Sidebar({ compact: initialCompact = false, user = null, className = "" }) {
  const [compact, setCompact] = useState(initialCompact);

  // product count state
  const [productCount, setProductCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // user.role: numeric role_id from backend (1 admin, 2 editor, etc.)
  const role = user?.role ?? null;
  const isAdmin = role && Number(role) === 1;

  const items = [
    { to: "/dashboard", label: "Overview", icon: <FiHome /> },
    { to: "/dashboard/products", label: "Products", icon: <FiBox /> },
    { to: "/dashboard/blogs", label: "Blogs", icon: <FiFileText /> },
    { to: "/dashboard/users", label: "Users", icon: <FiUsers />, adminOnly: true },
    { to: "/dashboard/Leads", label: "Leads", icon: <FiBell />, adminOnly: true },
  ];

  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      try {
        setLoadingCount(true);
        // ask for just 1 row but rely on API returning `total` for pagination
        const res = await apiGet("/products?limit=1");
        if (!mounted) return;
        if (res && typeof res === "object") {
          if (typeof res.total === "number") setProductCount(res.total);
          else if (Array.isArray(res.products)) setProductCount(res.products.length);
          else if (Array.isArray(res)) setProductCount(res.length);
          else setProductCount(null);
        } else {
          setProductCount(null);
        }
      } catch (e) {
        console.warn("[Sidebar] failed to load product count", e);
        if (mounted) setProductCount(null);
      } finally {
        if (mounted) setLoadingCount(false);
      }
    }

    loadCount();

    return () => { mounted = false; };
  }, []);

  // small helper for initials avatar
  function initialsOf(name) {
    if (!name) return "S2";
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || "").join("") || "U";
  }

  return (
    <aside className={clsx("flex flex-col h-full bg-white/60 backdrop-blur-md border-r border-slate-100", className)}>

      {/* Top: user / brand */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-100">
        <div className={clsx("flex items-center gap-3", compact ? "justify-center w-full" : "")}>
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-sprada3 to-sprada2 flex items-center justify-center text-white font-semibold shadow-sm">
            <span className="select-none">{initialsOf(user?.name || user?.username || "S2")}</span>
          </div>

          {!compact && (
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-sprada2 leading-tight">
                {user?.name || user?.username || "Sprada Admin"}
              </div>
              <div className="text-xs text-sprada2/70 mt-0.5">
                {user?.email || (user?.role ? `Role ${user.role}` : "Administrator")}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCompact(v => !v)}
          className="p-2 rounded-md hover:bg-sprada1/10 transition transform active:scale-95"
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
        >
          {compact ? <FiMenu /> : <FiChevronLeft />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-4 flex-1 flex flex-col gap-1 overflow-auto">
        {items.map(it => {
          if (it.adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150",
                  isActive
                    ? "bg-sprada1/20 ring-1 ring-sprada3/30 font-medium text-sprada2 shadow-sm"
                    : "text-sprada2/80 hover:bg-sprada1/10 hover:text-sprada2"
                )
              }
            >
              <span className="text-lg opacity-95">{it.icon}</span>

              {!compact && (
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">{it.label}</span>

                  {/* show product count only for Products row */}
                  {it.to === "/dashboard/products" && (
                    <span className="ml-2 flex items-center">
                      {loadingCount ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                        </span>
                      ) : productCount != null ? (
                        <span className="inline-flex items-center justify-center min-w-[26px] px-2 h-6 text-xs font-semibold rounded-full bg-sprada3/10 text-sprada3">
                          {productCount}
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-100 bg-gradient-to-t from-white/60 to-transparent">
        {!compact && (
          <div className="text-xs text-slate-500 mb-3">
            Design and Managed by <strong className="text-sprada2">"EXOTECH Developers"</strong>.
            <div className="mt-1">
              For more contact us{" "}
              <a href="https://www.exotech.co.in" target="_blank" rel="noopener noreferrer" className="text-sprada3 underline">
                www.exotech.co.in
              </a>
            </div>
          </div>
        )}

        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sprada1/10 transition text-sprada2/80"
          onClick={() => {
            try {
              // if you have an auth provider, call logout there instead
              localStorage.clear();
              window.location.href = "/login";
            } catch {
              window.location.href = "/login";
            }
          }}
        >
          <span className="text-sm font-medium">{compact ? "Logout" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}

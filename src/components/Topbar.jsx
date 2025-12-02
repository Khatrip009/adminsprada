// src/components/Topbar.jsx
import React, { useEffect, useState } from "react";
import { FiSearch, FiBell, FiChevronDown, FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "./NotificationCenter";
import { auth } from "../App";

// IMPORT LOGO
import Logo from "../assets/SPRADA_LOGO.png";

/**
 * Topbar with fully working Light / Dark theme toggle.
 *
 * Behavior:
 *  - reads saved theme from localStorage.key "sprada_theme" ("light" | "dark")
 *  - if not present, falls back to system preference (prefers-color-scheme)
 *  - toggling updates document.documentElement.classList ('dark') so Tailwind
 *    dark: utilities work, and persists preference to localStorage.
 *  - exposes smooth icon transition + aria attributes for accessibility.
 */

const THEME_KEY = "sprada_theme";

function readInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) { /* ignore */ }

  // fallback to system preference
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export default function Topbar({ onSearch }) {
  const [openNoti, setOpenNoti] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);
  const navigate = useNavigate();

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.warn("theme apply failed", e);
    }
  }, [theme]);

  // Handle system theme changes: if user hasn't explicitly chosen (no localStorage), update live
  useEffect(() => {
    let mql;
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (!saved && window.matchMedia) {
        mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (ev) => setTheme(ev.matches ? "dark" : "light");
        mql.addEventListener ? mql.addEventListener("change", handler) : mql.addListener(handler);
        return () => {
          mql.removeEventListener ? mql.removeEventListener("change", handler) : mql.removeListener(handler);
        };
      }
    } catch (e) { /* ignore */ }
    return () => { if (mql && mql.removeEventListener) mql.removeEventListener(); };
  }, []);

  // -------------------------------
  // LOGOUT HANDLER
  // -------------------------------
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    try {
      if (auth && typeof auth.logout === "function") auth.logout();
      else {
        if (typeof auth.setAuthenticated === "function")
          auth.setAuthenticated(false);
        if (typeof auth.setUser === "function") auth.setUser(null);
      }
    } catch (e) {
      console.warn("auth logout hook failed", e);
    }

    navigate("/login", { replace: true });
  };

  const user = JSON.parse(localStorage.getItem("user") || "null");

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-100 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm sticky top-0 z-20">
      {/* LEFT SECTION — LOGO + SEARCH */}
      <div className="flex items-center gap-6">
        {/* LOGO */}
        <div
          className="flex items-center cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          <img
            src={Logo}
            alt="SPRADA Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* SEARCH BOX */}
        <div className="relative hidden md:block">
          <input
            placeholder="Search products, blogs, visitors..."
            onChange={(e) => onSearch && onSearch(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm
                      focus:ring-2 focus:ring-sprada3/30 outline-none transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            aria-label="Topbar search"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">
            <FiSearch />
          </span>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4">
        {/* THEME TOGGLE */}
        <div className="relative">
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-2"
          >
            <span className="sr-only">Toggle theme</span>
            <div className="w-7 h-7 flex items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 transition">
              {theme === "dark" ? (
                <FiSun className="text-yellow-400" />
              ) : (
                <FiMoon className="text-slate-600" />
              )}
            </div>
          </button>
        </div>

        {/* NOTIFICATIONS */}
        <div className="relative">
          <button
            onClick={() => setOpenNoti((s) => !s)}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
            title="Notifications"
            aria-expanded={openNoti}
            aria-controls="notification-center"
          >
            <FiBell />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
          </button>

          {openNoti && (
            <div id="notification-center" className="absolute right-0 mt-2 z-40">
              <NotificationCenter onClose={() => setOpenNoti(false)} />
            </div>
          )}
        </div>

        {/* PROFILE SECTION */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu((s) => !s)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-haspopup="true"
            aria-expanded={openMenu}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sprada3 to-sprada2 flex items-center justify-center text-white font-bold">
              {(user?.full_name?.[0] || "A").toUpperCase()}
            </div>

            <div className="hidden md:block text-sm text-left">
              <div className="font-medium text-sprada2 dark:text-slate-100">
                {user?.full_name || "Admin"}
              </div>
              <div className="text-xs text-sprada2/60 dark:text-slate-300/70">
                {user?.email || "sprada@example.com"}
              </div>
            </div>

            <FiChevronDown className="text-sprada3/70 dark:text-slate-300/60" />
          </button>

          {/* DROPDOWN MENU */}
          {openMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 shadow-lg rounded-lg border border-gray-100 dark:border-slate-800 py-2 z-30">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

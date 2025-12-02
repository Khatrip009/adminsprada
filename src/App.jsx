// src/App.jsx
import React, { useRef, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Blogs from "./pages/Blogs";
import BlogEditorPage from "./pages/BlogEditorPage";
import UserPage from "./pages/UserPage";
import { AuthProvider, useAuth } from "./context/AuthProvider";
export { auth } from "./lib/auth";
import LeadsPage from "./pages/LeadsPage";
import Topbar from "./components/Topbar";
import ErrorPage from "./pages/ErrorPage";

// SAFE RequireAuth
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// DashboardLayout (unchanged)
function DashboardLayout({ children }) {
  const authCtx = useAuth();
  const user = authCtx?.user || JSON.parse(localStorage.getItem("user") || "null");
  const logout = authCtx?.logout || (() => {
    localStorage.clear();
    window.location.href = "/login";
  });

  const topbarRef = useRef(null);

  useEffect(() => {
    const DEFAULT_HEADER = 72;
    const measure = () => {
      try {
        const el = topbarRef.current || document.querySelector(".app-topbar");
        const height = el && el.offsetHeight ? el.offsetHeight : DEFAULT_HEADER;
        document.documentElement.style.setProperty("--app-header-height", `${height}px`);
      } catch {
        document.documentElement.style.setProperty("--app-header-height", `${DEFAULT_HEADER}px`);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    let ro = null;
    try {
      if (window.ResizeObserver && topbarRef.current) {
        ro = new ResizeObserver(measure);
        ro.observe(topbarRef.current);
      }
    } catch (e) { /* ignore */ }
    return () => {
      window.removeEventListener("resize", measure);
      try { if (ro && topbarRef.current) ro.unobserve(topbarRef.current); } catch (_) {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div ref={topbarRef} className="app-topbar">
        <Topbar user={user} onLogout={logout} />
      </div>
      <main className="p-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <RequireAuth>
              <DashboardLayout><Dashboard /></DashboardLayout>
            </RequireAuth>
          } />

          <Route path="/dashboard/products" element={
            <RequireAuth>
              <DashboardLayout><Products /></DashboardLayout>
            </RequireAuth>
          } />

          <Route path="/dashboard/blogs" element={
            <RequireAuth>
              <DashboardLayout><Blogs /></DashboardLayout>
            </RequireAuth>
          } />
          <Route path="/dashboard/blogs/new" element={
            <RequireAuth>
              <DashboardLayout><BlogEditorPage mode="new" /></DashboardLayout>
            </RequireAuth>
          } />
          <Route path="/dashboard/blogs/edit/:id" element={
            <RequireAuth>
              <DashboardLayout><BlogEditorPage mode="edit" /></DashboardLayout>
            </RequireAuth>
          } />

          <Route path="/dashboard/leads" element={
            <RequireAuth>
              <DashboardLayout><LeadsPage /></DashboardLayout>
            </RequireAuth>
          } />
          <Route path="/dashboard/users" element={
            <RequireAuth>
              <DashboardLayout><UserPage /></DashboardLayout>
            </RequireAuth>
          } />

          <Route path="/error" element={<ErrorPage status={500} title="Server error" message="Something went wrong on the server." />} />
          <Route path="*" element={<ErrorPage status={404} title="Page not found" message="The page you're looking for doesn't exist." />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

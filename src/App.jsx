// src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Blogs from "./pages/Blogs";
import BlogEditorPage from "./pages/BlogEditorPage";
import UserPage from "./pages/UserPage"; // Ensure this matches your file name (UsersPage.jsx)
import { AuthProvider, useAuth } from "./context/AuthProvider";
export { auth } from "./lib/auth";
import LeadsPage from "./pages/LeadsPage";
import ErrorPage from "./pages/ErrorPage";

// Protected route wrapper
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Protected routes – each page is self‑contained */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/products"
            element={
              <RequireAuth>
                <Products />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/blogs"
            element={
              <RequireAuth>
                <Blogs />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/blogs/new"
            element={
              <RequireAuth>
                <BlogEditorPage mode="new" />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/blogs/edit/:id"
            element={
              <RequireAuth>
                <BlogEditorPage mode="edit" />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/leads"
            element={
              <RequireAuth>
                <LeadsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <RequireAuth>
                <UserPage />
              </RequireAuth>
            }
          />

          {/* Error routes */}
          <Route
            path="/error"
            element={<ErrorPage status={500} title="Server error" message="Something went wrong on the server." />}
          />
          <Route
            path="*"
            element={<ErrorPage status={404} title="Page not found" message="The page you're looking for doesn't exist." />}
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
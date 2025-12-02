// src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  // ❗ Important: Only check "user", NOT authClient.isAuthenticated()
  // because "user" is stable state (not re-computed every render)
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

// src/context/AuthProvider.jsx (unchanged)
import React, { createContext, useContext, useEffect, useState } from "react";
import authClient from "../lib/auth";

const AuthContext = createContext({
  auth: authClient,
  user: null,
  loading: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authClient.getUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = authClient.subscribe(({ user: u }) => {
      setUser(u || null);
    });
    return unsub;
  }, []);

  async function loginFromApiResponse(respObj) {
    await authClient.loginWithTokens(respObj);
  }

  async function logout() {
    await authClient.logout();
  }

  const value = {
    auth: authClient,
    user,
    loading,
    setLoading,
    loginFromApiResponse,
    logout,
    isAuthenticated: authClient.isAuthenticated(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
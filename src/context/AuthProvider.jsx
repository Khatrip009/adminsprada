// src/context/AuthProvider.jsx
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
    // subscribe to auth changes (tokens/user updates)
    const unsub = authClient.subscribe(({ user: u }) => {
      setUser(u || null);
    });
    return unsub;
  }, []);

  // helper wrappers
  async function loginFromApiResponse(respObj) {
    // respObj expected: { accessToken, refreshToken, user }
    await authClient.loginWithTokens(respObj);
  }

  async function logout() {
    await authClient.logout();
  }

  // expose a small surface that's convenient inside react components
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

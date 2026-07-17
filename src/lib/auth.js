// src/lib/auth.js – Supabase‑powered auth client (uses shared supabase)
import { supabase } from './supabaseClient';

const createAuthClient = () => {
  let user = null;
  let accessToken = null;
  let refreshToken = null;
  let listeners = new Set();
  let refreshingPromise = null;

  function notify() {
    listeners.forEach(cb => {
      try { cb({ user, accessToken, refreshToken }); } catch (_) {}
    });
  }

  // Subscribe to Supabase auth changes
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      user = null;
      accessToken = null;
      refreshToken = null;
    } else {
      user = session.user || null;
      accessToken = session.access_token || null;
      refreshToken = session.refresh_token || null;
    }
    notify();
  });

  // Load initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      user = session.user;
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
    } else {
      user = null;
      accessToken = null;
      refreshToken = null;
    }
    notify();
  }).catch(() => {
    user = null;
    accessToken = null;
    refreshToken = null;
    notify();
  });

  // Public API
  async function loginWithTokens({ accessToken: a, refreshToken: r, user: u }) {
    user = u || null;
    accessToken = a || null;
    refreshToken = r || null;
    notify();
    return { user, accessToken, refreshToken };
  }

  async function logout() {
    await supabase.auth.signOut();
    user = null;
    accessToken = null;
    refreshToken = null;
    notify();
  }

  function isAuthenticated() { return !!accessToken; }
  function getAccessToken() { return accessToken; }
  function getUser() { return user; }
  function setUser(u) { user = u; notify(); }
  function setAccessToken(t) { accessToken = t; notify(); }
  function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  async function refreshTokens() {
    if (!refreshToken) throw new Error('no_refresh_token');
    if (refreshingPromise) return refreshingPromise;
    refreshingPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        if (data.session) {
          user = data.session.user;
          accessToken = data.session.access_token;
          refreshToken = data.session.refresh_token;
          notify();
          return accessToken;
        }
        throw new Error('refresh_failed');
      } finally {
        refreshingPromise = null;
      }
    })();
    return refreshingPromise;
  }

  async function fetchWithAuth(input, init = {}) {
    const headers = new Headers(init.headers || {});
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const res = await fetch(input, { ...init, headers, credentials: init.credentials ?? 'include' });
    if (res.status !== 401) return res;
    try {
      await refreshTokens();
      const headers2 = new Headers(init.headers || {});
      if (accessToken) headers2.set('Authorization', `Bearer ${accessToken}`);
      return await fetch(input, { ...init, headers: headers2, credentials: init.credentials ?? 'include' });
    } catch (_) {
      await logout();
      return res;
    }
  }

  return {
    isAuthenticated,
    getAccessToken,
    getUser,
    loginWithTokens,
    logout,
    setUser,
    setAccessToken,
    refreshTokens,
    fetchWithAuth,
    subscribe,
  };
};

export const auth = createAuthClient();
export default auth;
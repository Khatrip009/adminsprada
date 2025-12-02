// src/lib/auth.js
// Lightweight singleton "auth client" used across the app.
// Responsible for: token storage, user storage, login/logout, refresh, and subscriptions.

const API_REFRESH_URL = "/api/auth/refresh"; // backend endpoint (adjust if different)

function safeJSONParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

const STORAGE = {
  access: "accessToken",
  refresh: "refreshToken",
  user: "user",
};

const createAuthClient = () => {
  let user = safeJSONParse(localStorage.getItem(STORAGE.user)) || null;
  let accessToken = localStorage.getItem(STORAGE.access) || null;
  let refreshToken = localStorage.getItem(STORAGE.refresh) || null;

  let listeners = new Set();
  let refreshingPromise = null; // single inflight refresh

  function notify() {
    listeners.forEach((cb) => {
      try { cb({ user, accessToken, refreshToken }); } catch (e) { /* ignore */ }
    });
  }

  // persisting helpers
  function persist() {
    if (accessToken) localStorage.setItem(STORAGE.access, accessToken);
    else localStorage.removeItem(STORAGE.access);

    if (refreshToken) localStorage.setItem(STORAGE.refresh, refreshToken);
    else localStorage.removeItem(STORAGE.refresh);

    if (user) localStorage.setItem(STORAGE.user, JSON.stringify(user));
    else localStorage.removeItem(STORAGE.user);
  }

  async function loginWithTokens({ accessToken: a, refreshToken: r, user: u }) {
    accessToken = a || null;
    refreshToken = r || null;
    user = u || null;
    persist();
    notify();
    return { user, accessToken, refreshToken };
  }

  async function logout() {
    accessToken = null;
    refreshToken = null;
    user = null;
    persist();
    notify();
  }

  function isAuthenticated() {
    return !!accessToken;
  }

  function getAccessToken() {
    return accessToken;
  }

  function getUser() {
    return user;
  }

  function setUser(u) {
    user = u;
    persist();
    notify();
  }

  function setAccessToken(t) {
    accessToken = t;
    persist();
    notify();
  }

  function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  // Attempt to refresh tokens using refreshToken. Returns new accessToken or throws.
  async function refreshTokens() {
    if (!refreshToken) throw new Error("no_refresh_token");

    // If a refresh is already in progress — reuse promise
    if (refreshingPromise) return refreshingPromise;

    refreshingPromise = (async () => {
      try {
        const res = await fetch(API_REFRESH_URL, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          // refresh failed: clear tokens and throw
          await logout();
          const txt = await res.text().catch(() => "");
          const err = new Error("refresh_failed");
          err.status = res.status;
          err.body = txt;
          throw err;
        }

        const data = await res.json().catch(() => null);
        // Expecting: { accessToken, refreshToken?, user? } — adapt if your backend differs
        if (!data?.accessToken) {
          // nothing useful returned -> fail
          await logout();
          throw new Error("invalid_refresh_response");
        }

        accessToken = data.accessToken;
        if (data.refreshToken) refreshToken = data.refreshToken;
        if (data.user) user = data.user;
        persist();
        notify();
        return accessToken;
      } finally {
        refreshingPromise = null;
      }
    })();

    return refreshingPromise;
  }

  // Decorator: fetch with Authorization header and automatic refresh on 401.
  async function fetchWithAuth(input, init = {}) {
    const headers = new Headers(init.headers || {});

    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const res = await fetch(input, { ...init, headers, credentials: init.credentials ?? "include" });

    if (res.status !== 401) return res;

    // 401 -> attempt refresh then retry once
    try {
      await refreshTokens(); // may throw
      const headers2 = new Headers(init.headers || {});
      if (accessToken) headers2.set("Authorization", `Bearer ${accessToken}`);
      return await fetch(input, { ...init, headers: headers2, credentials: init.credentials ?? "include" });
    } catch (err) {
      // refresh failed -> ensure logged out state
      await logout();
      return res; // return original 401 response
    }
  }

  return {
    // state getters
    isAuthenticated,
    getAccessToken,
    getUser,

    // actions
    loginWithTokens, // used by your login flow after backend returns tokens
    logout,
    setUser,
    setAccessToken,

    // refresh
    refreshTokens,

    // util
    fetchWithAuth,

    // subscriptions
    subscribe,
  };
};

export const auth = createAuthClient();
export default auth;

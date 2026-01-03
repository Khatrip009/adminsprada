// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as apiLogin } from "../lib/api";
import Logo from "../assets/SPRADA_LOGO.png";
import Stationary from "../assets/SPRADA_Stationary.png";
import { useAuth } from "../context/AuthProvider";

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // If already authenticated, send to dashboard
  useEffect(() => {
    try {
      if (auth?.user) {
        navigate("/dashboard", { replace: true });
      } else {
        const underlyingUser =
          auth?.auth && typeof auth.auth.getUser === "function"
            ? auth.auth.getUser()
            : null;
        if (underlyingUser) navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      // ignore navigation errors during mount
    }
  }, [auth, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      if (!email || !password) {
        toast.error("Email & password required");
        setBusy(false);
        return;
      }

      const data = await apiLogin(email, password);

      const accessToken =
        data?.accessToken ||
        data?.raw?.accessToken ||
        data?.raw?.access_token ||
        data?.token ||
        null;

      const refreshToken =
        data?.refreshToken ||
        data?.raw?.refreshToken ||
        data?.raw?.refresh_token ||
        null;

      const user =
        data?.user || data?.raw?.user || data?.raw?.userInfo || null;

      if (!accessToken) {
        console.error("Unexpected login payload:", data);
        toast.error("Token missing — check backend.");
        setBusy(false);
        return;
      }

      // Notify auth client/provider so React state updates immediately.
      if (auth && typeof auth.loginFromApiResponse === "function") {
        await auth.loginFromApiResponse({ accessToken, refreshToken, user });
      } else if (auth?.auth && typeof auth.auth.loginWithTokens === "function") {
        await auth.auth.loginWithTokens({ accessToken, refreshToken, user });
      } else {
        localStorage.setItem("accessToken", accessToken);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        if (user) localStorage.setItem("user", JSON.stringify(user));
      }

      toast.success("Signed in");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login error", err);
      if (err?.status === 401) toast.error("Invalid credentials");
      else toast.error(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("admin@sprada.local");
    setPassword("admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 bg-slate-50">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 items-stretch shadow-2xl bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden border border-sprada3/10">

        {/* Decorative aside (hidden on small screens). background uses bg-cover for consistent fill */}
        <aside
          className="relative hidden md:block bg-cover bg-center bg-no-repeat min-h-[420px] md:min-h-[560px] lg:min-h-[640px]"
          aria-hidden="true"
          style={{ backgroundImage: `url(${Stationary})` }}
        >
          {/* Subtle border overlay */}
          <div className="absolute inset-0 rounded-l-3xl pointer-events-none border border-sprada4/20" />
          <div className="absolute left-6 bottom-6 text-sprada1/90 z-10">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-semibold text-sprada4">Sprada 2 Global EXIM</div>
                <div className="text-xs text-sprada4/80">Rich Quality, Reach to Global</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="p-6 sm:p-8 md:p-12 flex items-center justify-center relative">
          <div className="w-full max-w-md sm:max-w-lg">

            <div className="mb-6 text-center md:text-left">
              {/* Logo: responsive width scaling */}
              <img
                src={Logo}
                alt="SPRADA logo"
                className="mx-auto md:mx-0 w-20 sm:w-24 md:w-28 h-auto mb-4"
                width={112}
                height={40}
              />
              <h1 className="text-3xl font-extrabold text-sprada2">Sprada2Global EXIM</h1>
              <p className="mt-2 text-sm text-sprada2/70 italic">Admin dashboard — sign in to continue</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <h2 className="text-2xl font-semibold text-sprada2 mb-1">Sign in</h2>
              <p className="text-sm text-sprada2/70 mb-6">Authorized personnel only.</p>

              {/* Form: role and aria-live for error messages */}
              <form onSubmit={handleSubmit} className="space-y-5" role="form" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2 text-sprada3">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    aria-label="Email address"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-sprada3/30 focus:border-sprada3 text-sprada2 text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2 text-sprada3">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    aria-label="Password"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-sprada3/30 focus:border-sprada3 text-sprada2 text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    aria-disabled={busy}
                    className="w-full sm:flex-1 py-3 rounded-xl bg-sprada3 text-white font-semibold tracking-wide shadow-lg disabled:opacity-60"
                  >
                    {busy ? "Signing in…" : "Sign In"}
                  </button>

                  
                </div>
              </form>
            </div>

            <div className="mt-6 text-center text-sm text-sprada2/60">
              © {new Date().getFullYear()} Sprada 2 Global EXIM — Managed by Exotech Developers
              <br className="sm:hidden" />
              <a
                href="https://www.exotech.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sprada3 hover:underline block sm:inline"
              >
                exotech.co.in
              </a>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

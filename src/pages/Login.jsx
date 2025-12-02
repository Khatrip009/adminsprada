// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as apiLogin } from "../lib/api";
import Logo from "../assets/SPRADA_LOGO.png";
import Stationary from "../assets/SPRADA_Stationary.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
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
        data?.raw?.access_token;

      const refreshToken =
        data?.refreshToken ||
        data?.raw?.refreshToken ||
        data?.raw?.refresh_token;

      const user =
        data?.user ||
        data?.raw?.user ||
        data?.raw?.userInfo;

      if (!accessToken) {
        console.error("Unexpected login payload:", data);
        toast.error("Token missing — check backend.");
        setBusy(false);
        return;
      }

      localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      toast.success("Signed in");

      // SINGLE redirect — prevents infinite loops
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
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-slate-50">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 shadow-2xl bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden border border-sprada3/10">

        <aside
          className="relative hidden md:block overflow-hidden"
          aria-hidden
          style={{
            backgroundImage: `url(${Stationary})`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            minHeight: 420,
          }}
        >
          <div className="absolute inset-0 rounded-l-3xl pointer-events-none border border-sprada4/20" />
          <div className="absolute left-8 bottom-8 text-sprada1/90 z-10">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-semibold text-sprada4">Sprada 2 Global EXIM</div>
                <div className="text-xs text-sprada4/80">Rich Quality, Reach to Global</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="p-10 md:p-12 flex items-center justify-center relative">
          <div className="w-full max-w-md">

            <div className="mb-6 text-center md:text-left">
              <img src={Logo} alt="SPRADA logo" className="mx-auto md:mx-0 w-28 h-auto mb-4" />
              <h1 className="text-3xl font-extrabold text-sprada2">Sprada2Global EXIM</h1>
              <p className="mt-2 text-sm text-sprada2/70 italic">Admin dashboard — sign in to continue</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <h2 className="text-2xl font-semibold text-sprada2 mb-1">Sign in</h2>
              <p className="text-sm text-sprada2/70 mb-6">Authorized personnel only.</p>

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-sm font-medium mb-2 text-sprada3">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-sprada3/30 focus:border-sprada3 outline-none text-sprada2 text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-sprada3">Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-sprada3/30 focus:border-sprada3 outline-none text-sprada2 text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-3 rounded-xl bg-sprada3 text-white font-semibold tracking-wide shadow-lg disabled:opacity-60"
                  >
                    {busy ? "Signing in…" : "Sign In"}
                  </button>

                  <button
                    type="button"
                    onClick={fillDemo}
                    className="px-5 py-3 rounded-xl border border-gray-300 text-sprada2 hover:bg-gray-50"
                  >
                    Fill demo
                  </button>
                </div>

              </form>

              <p className="text-xs text-sprada2/50 mt-4">
                Demo: <span className="font-medium">admin@sprada.local</span> / <span className="font-medium">admin</span>
              </p>
            </div>

            <div className="mt-6 text-center text-sm text-sprada2/60">
              © {new Date().getFullYear()} Sprada 2 Global EXIM
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

// src/pages/UsersPage.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import LOGO from "../assets/SPRADA_LOGO.png";
import { Toaster, toast } from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import dayjs from "dayjs";
import clsx from "clsx";

/* ---------------------------
   Theme & fonts (inject once)
   --------------------------- */
function ensureFontsInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("sprada-fonts")) return;
  const link = document.createElement("link");
  link.id = "sprada-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Roboto+Slab:wght@400;600&display=swap";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.id = "sprada-theme";
  style.innerHTML = `
    :root{
      --sprada-accent: #0f6b5a;
      --sprada-muted: #6b7280;
      --sprada-card: #ffffff;
      --sprada-surface: #f8fafb;
      --sprada-ring: rgba(15,107,90,0.14);
      --ui-radius: 12px;
      --shadow-1: 0 8px 28px rgba(14,28,37,0.06);
    }
    body { font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
    .sprada-heading { font-family: "Roboto Slab", Georgia, serif; }
    .focus-ring:focus { outline: none; box-shadow: 0 0 0 4px var(--sprada-ring); border-color: var(--sprada-accent); }
    @media (max-width: 420px) {
      .mobile-sheet { height: 100vh; border-radius: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ---------------------------
   Helpers
   --------------------------- */
function useDebouncedValue(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function generatePassword(length = 14) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()-_+=[]{}<>?";
  const all = upper + lower + digits + symbols;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];
  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join("");
}

/* ---------------------------
   User Modal (Create / Edit)
   Responsive: full-screen on xs, centered on md+
   --------------------------- */
function UserModal({ open, onClose, onSaved, initial = null }) {
  const isEdit = Boolean(initial && initial.id);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role_id: 3,
    is_active: true,
    password: ""
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        email: initial.email || "",
        full_name: initial.full_name || "",
        role_id: initial.role_id || 3,
        is_active: initial.is_active !== undefined ? !!initial.is_active : true,
        password: ""
      });
    } else {
      setForm({ email: "", full_name: "", role_id: 3, is_active: true, password: "" });
    }
  }, [open, initial, isEdit]);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleGenerate() {
    const p = generatePassword(14);
    setForm(f => ({ ...f, password: p }));
    navigator.clipboard?.writeText(p).then(() => {
      toast.success("Generated password copied to clipboard");
    }).catch(() => {
      toast.success("Password generated");
    });
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!form.email || !form.full_name) return toast.error("Name & email required");
    setBusy(true);
    try {
      if (isEdit) {
        const payload = { full_name: form.full_name, role_id: Number(form.role_id), is_active: !!form.is_active };
        await apiPut(`/users/${encodeURIComponent(initial.id)}`, payload);
        if (form.password && form.password.length >= 6) {
          await apiPut(`/users/${encodeURIComponent(initial.id)}/password`, { password: form.password });
        }
        toast.success("User updated");
      } else {
        if (!form.password || form.password.length < 6) {
          toast.error("Please provide a password (auto-generate recommended)");
          setBusy(false);
          return;
        }
        const payload = {
          email: form.email,
          full_name: form.full_name,
          role_id: Number(form.role_id),
          is_active: !!form.is_active,
          password: form.password
        };
        await apiPost("/users", payload);
        toast.success("User created");
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      console.error("user modal submit:", err);
      const msg = (err && err.data && (err.data.error || err.data.message)) || err.message || "Server error";
      toast.error(String(msg));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) onClose(); }} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-t-xl sm:rounded-2xl shadow-[var(--shadow-1)] w-full sm:w-[720px] max-w-full p-4 sm:p-6 z-10 overflow-auto mobile-sheet max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit user" : "Create user"}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Sprada" className="w-16 sm:w-20 object-contain" />
            <div>
              <h3 className="sprada-heading text-lg font-semibold">{isEdit ? "Edit User" : "Create User"}</h3>
              <div className="text-xs text-[color:var(--sprada-muted)]">{isEdit ? `ID: ${initial?.id?.slice?.(0,8)}` : "Add a new application user"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { if (!busy) onClose(); }} className="px-3 py-2 border rounded bg-white text-sm">Close</button>
            <button type="submit" disabled={busy} className={clsx("px-4 py-2 rounded text-white text-sm", busy ? "bg-slate-400" : "bg-[color:var(--sprada-accent)]")}>
              {busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create user")}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)] mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setField("email", e.target.value)}
              required={!isEdit}
              disabled={isEdit}
              className="w-full border rounded px-3 py-2 focus-ring"
            />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)] mb-1">Full name</label>
            <input value={form.full_name} onChange={e => setField("full_name", e.target.value)} className="w-full border rounded px-3 py-2 focus-ring" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)] mb-1">Role</label>
            <select value={form.role_id} onChange={e => setField("role_id", e.target.value)} className="w-full border rounded px-3 py-2 focus-ring">
              <option value={1}>Administrator (1)</option>
              <option value={2}>Editor (2)</option>
              <option value={3}>User (3)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-full">
              <label className="block text-xs text-[color:var(--sprada-muted)] mb-1">Active</label>
              <div>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!form.is_active} onChange={e => setField("is_active", e.target.checked)} />
                  <span className="text-sm text-[color:var(--sprada-muted)]">Enabled</span>
                </label>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-[color:var(--sprada-muted)] mb-1">Password {isEdit && <span className="text-xs text-slate-400"> (leave empty to keep)</span>}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={form.password} onChange={e => setField("password", e.target.value)} placeholder={isEdit ? "New password (optional)" : "Set password or generate one"} className="flex-1 border rounded px-3 py-2 focus-ring" />
              <div className="flex gap-2 sm:flex-col sm:items-stretch">
                <button type="button" onClick={handleGenerate} className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">Generate</button>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(form.password || ""); toast.success("Copied"); }} disabled={!form.password} className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">Copy</button>
              </div>
            </div>
            <div className="text-xs text-[color:var(--sprada-muted)] mt-2">We recommend sharing generated passwords securely. Backend hashes on create/update.</div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------
   Main UsersPage
   --------------------------- */
export default function UsersPage() {
  useEffect(() => { ensureFontsInjected(); }, []);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  // sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // topbar measurement to set CSS var for content padding
  const topbarRef = useRef(null);
  useEffect(() => {
    const DEFAULT_HEADER = 72;
    let mounted = true;
    const measure = () => {
      try {
        const el = topbarRef.current || document.querySelector(".app-topbar");
        const h = el && el.offsetHeight ? el.offsetHeight : DEFAULT_HEADER;
        if (mounted) document.documentElement.style.setProperty("--app-header-height", `${h}px`);
      } catch {
        if (mounted) document.documentElement.style.setProperty("--app-header-height", `${DEFAULT_HEADER}px`);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => { mounted = false; window.removeEventListener("resize", measure); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[color:var(--sprada-surface)] text-slate-800">
      <Toaster position="top-right" />

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72">
        <Sidebar user={user} className="w-72" />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 overflow-auto">
            <Sidebar user={user} />
            <div className="mt-4">
              <button onClick={() => setMobileSidebarOpen(false)} className="px-3 py-2 border rounded w-full">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar (fixed) */}
      <div ref={topbarRef} className="app-topbar fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur">
        <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full pt-[var(--app-header-height,72px)]">
        <Header user={user} onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <div className="bg-[color:var(--sprada-card)] rounded-2xl shadow-[var(--shadow-1)] p-3 sm:p-5">
          <UsersAdmin />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------
   Header
   --------------------------- */
function Header({ user, onOpenSidebar }) {
  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
      <div className="flex items-center gap-4 w-full">
        {/* Visible hamburger for small screens */}
        <button
          onClick={() => onOpenSidebar && onOpenSidebar()}
          className="lg:hidden p-2 rounded-md border mr-2"
          aria-label="Open sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Sprada" className="w-24 sm:w-28 object-contain" />
          <div>
            <h1 className="text-lg sm:text-2xl sprada-heading font-semibold text-[color:var(--sprada-accent)]">Users</h1>
            <div className="text-xs text-[color:var(--sprada-muted)]">Manage application users, roles & security</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-[color:var(--sprada-muted)] hidden sm:block">Signed in as</div>
        <div className="px-3 py-2 bg-white border rounded-lg shadow-sm text-sm">{user?.full_name || user?.name || "Admin"}</div>
      </div>
    </header>
  );
}

/* ---------------------------
   UsersAdmin (responsive)
   - Mobile uses cards with overflow menu (<details>) to avoid overlapping buttons
   - Desktop uses table; table hidden on small screens
   --------------------------- */
function UsersAdmin() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  const [q, setQ] = useState("");
  const debQ = useDebouncedValue(q, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState(null);

  const [busyActionId, setBusyActionId] = useState(null);
  const [error, setError] = useState("");

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (debQ) qs.set("q", debQ);
      if (page) qs.set("page", String(page));
      if (limit) qs.set("limit", String(limit));
      const res = await apiGet(`/users?${qs.toString()}`);
      if (!res) throw new Error("Empty response");

      if (Array.isArray(res)) {
        setUsers(res);
        setTotal(res.length);
      } else if (res.users && Array.isArray(res.users)) {
        setUsers(res.users);
        setTotal(typeof res.total === "number" ? res.total : res.users.length);
      } else if (res.data && Array.isArray(res.data.users)) {
        setUsers(res.data.users);
        setTotal(res.data.total || res.data.users.length);
      } else {
        const arr = res.users || res.data || [];
        setUsers(Array.isArray(arr) ? arr : []);
        setTotal(res.total || (Array.isArray(arr) ? arr.length : 0));
      }
    } catch (err) {
      console.error("load users", err);
      setError("Failed loading users");
      toast.error("Failed loading users");
    } finally {
      setLoading(false);
    }
  }, [debQ, page, limit]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setModalUser(null);
    setModalOpen(true);
  }
  function openEdit(u) {
    setModalUser(u);
    setModalOpen(true);
  }

  async function handleDelete(u) {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    setBusyActionId(u.id);
    try {
      await apiDelete(`/users/${encodeURIComponent(u.id)}`);
      toast.success("User deleted");
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      console.error("delete user", err);
      const msg = (err && err.data && (err.data.error || err.data.message)) || err.message || "Delete failed";
      toast.error(String(msg));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleToggleActive(u) {
    setBusyActionId(u.id);
    try {
      await apiPut(`/users/${encodeURIComponent(u.id)}`, { is_active: !u.is_active });
      toast.success(u.is_active ? "User deactivated" : "User activated");
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_active: !p.is_active, updated_at: new Date().toISOString() } : p));
    } catch (err) {
      console.error("toggle active", err);
      toast.error("Update failed");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleChangePassword(u) {
    const pwd = prompt(`Set new password for ${u.email} (leave blank to cancel).`);
    if (!pwd) return;
    if (pwd.length < 6) return toast.error("Password must be at least 6 characters");
    setBusyActionId(u.id);
    try {
      await apiPut(`/users/${encodeURIComponent(u.id)}/password`, { password: pwd });
      toast.success("Password updated");
    } catch (err) {
      console.error("change password", err);
      toast.error("Password update failed");
    } finally {
      setBusyActionId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((total || users.length) / limit));

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold">User management</h3>
          <p className="text-xs text-[color:var(--sprada-muted)]">Create, edit and manage application users</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            placeholder="Search by name or email..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-4 pr-3 py-2 border rounded-lg w-full sm:w-64 focus-ring"
            aria-label="Search users"
          />
          <div className="flex gap-2">
            <button onClick={openCreate} className="px-3 py-2 rounded bg-[color:var(--sprada-accent)] text-white shadow hover:shadow-md transition">Create</button>
            <button onClick={load} className="px-3 py-2 rounded border bg-white">Refresh</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2">
          <div className="text-sm text-[color:var(--sprada-muted)]">Showing {users.length} users</div>
          <div className="text-xs text-slate-400">Total: {total ?? users.length}</div>
        </div>

        {/* Loading / Empty / Content */}
        <div>
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: limit }).map((_, i) => (
                <div key={i} className="animate-pulse py-3 border-b">
                  <div className="h-4 bg-gray-100 rounded w-48 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-[color:var(--sprada-muted)]">No users found</div>
          ) : isMobile ? (
            /* Mobile cards: actions in overflow menu (details) to avoid overlap */
            <div className="p-4 space-y-3">
              {users.map(u => (
                <article key={u.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-medium text-slate-800 truncate">{u.full_name || "—"}</h4>
                        <div className="text-xs text-slate-500">{u.created_at ? dayjs(u.created_at).format("D MMM YYYY") : "-"}</div>
                      </div>
                      <div className="text-sm text-slate-600 truncate">{u.email}</div>
                      <div className="text-xs text-[color:var(--sprada-muted)] mt-1">{u.role_id === 1 ? "Admin" : u.role_id === 2 ? "Editor" : `Role ${u.role_id}`}</div>
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <div className="text-xs">{u.is_active ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</div>
                        <div className="text-xs text-slate-400">{u.updated_at ? `Updated ${dayjs(u.updated_at).fromNow?.() || dayjs(u.updated_at).format("D MMM")}` : ""}</div>
                      </div>
                    </div>

                    {/* Overflow actions to avoid many inline buttons on small screens */}
                    <div className="ml-2 shrink-0">
                      <details className="relative">
                        <summary className="list-none cursor-pointer px-2 py-1 border rounded inline-flex items-center gap-2 text-sm">Actions ▾</summary>
                        <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
                          <button onClick={() => openEdit(u)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Edit</button>
                          <button onClick={() => handleToggleActive(u)} disabled={busyActionId === u.id} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                            {busyActionId === u.id ? "…" : (u.is_active ? "Deactivate" : "Activate")}
                          </button>
                          <button onClick={() => handleChangePassword(u)} disabled={busyActionId === u.id} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Pwd</button>
                          <button onClick={() => handleDelete(u)} disabled={busyActionId === u.id} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">Delete</button>
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            /* Desktop table */
            <div className="overflow-auto">
              <table className="w-full table-auto text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-gray-50">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{u.full_name || "—"}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.role_id === 1 ? "Admin" : u.role_id === 2 ? "Editor" : `Role ${u.role_id}`}</td>
                      <td className="px-4 py-3">{u.is_active ? <span className="text-green-600">Yes</span> : <span className="text-red-500">No</span>}</td>
                      <td className="px-4 py-3">{u.created_at ? dayjs(u.created_at).format("D MMM YYYY") : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => openEdit(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50">Edit</button>
                          <button disabled={busyActionId === u.id} onClick={() => handleToggleActive(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50">
                            {busyActionId === u.id ? "…" : (u.is_active ? "Deactivate" : "Activate")}
                          </button>
                          <button disabled={busyActionId === u.id} onClick={() => handleChangePassword(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50">Pwd</button>
                          <button disabled={busyActionId === u.id} onClick={() => handleDelete(u)} className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-xs text-[color:var(--sprada-muted)]">Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-red-600">{error}</div>

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); setModalUser(null); load(); }}
        initial={modalUser}
      />
    </div>
  );
}

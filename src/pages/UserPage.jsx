// src/pages/UsersPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
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
  `;
  document.head.appendChild(style);
}

/* ---------------------------
   Small helpers
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
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!busy) onClose(); }} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-[var(--shadow-1)] w-full max-w-2xl p-6 z-10 transform transition-transform duration-200 ease-out"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit user" : "Create user"}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <div>
              <h3 className="sprada-heading text-lg font-semibold">{isEdit ? "Edit User" : "Create User"}</h3>
              <div className="text-xs text-[color:var(--sprada-muted)]">{isEdit ? `ID: ${initial?.id?.slice?.(0,8)}` : "Add a new application user"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { if (!busy) onClose(); }} className="px-3 py-2 border rounded hover:bg-slate-50 transition">Close</button>
            <button type="submit" disabled={busy} className={clsx("px-4 py-2 rounded text-white transition transform active:scale-95", busy ? "bg-slate-400" : "bg-[color:var(--sprada-accent)]")}>
              {busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create user")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Email</label>
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
            <label className="block text-xs text-[color:var(--sprada-muted)]">Full name</label>
            <input value={form.full_name} onChange={e => setField("full_name", e.target.value)} className="w-full border rounded px-3 py-2 focus-ring" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Role</label>
            <select value={form.role_id} onChange={e => setField("role_id", e.target.value)} className="w-full border rounded px-3 py-2 focus-ring">
              <option value={1}>Administrator (1)</option>
              <option value={2}>Editor (2)</option>
              <option value={3}>User (3)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="block text-xs text-[color:var(--sprada-muted)]">Active</label>
            <div className="ml-auto">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.is_active} onChange={e => setField("is_active", e.target.checked)} />
                <span className="text-sm text-[color:var(--sprada-muted)]">Enabled</span>
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-[color:var(--sprada-muted)]">Password {isEdit && <span className="text-xs text-slate-400"> (leave empty to keep)</span>}</label>
            <div className="flex gap-2">
              <input value={form.password} onChange={e => setField("password", e.target.value)} placeholder={isEdit ? "New password (optional)" : "Set password or generate one"} className="flex-1 border rounded px-3 py-2 focus-ring" />
              <button type="button" onClick={handleGenerate} className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition">Generate</button>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(form.password || ""); toast.success("Copied"); }} disabled={!form.password} className="px-3 py-2 border rounded bg-white hover:bg-gray-50 transition">Copy</button>
            </div>
            <div className="text-xs text-[color:var(--sprada-muted)] mt-1">We recommend sharing generated passwords securely. Backend hashes on create/update.</div>
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

  return (
    <div className="min-h-screen flex bg-[color:var(--sprada-surface)] text-slate-800">
      <Toaster position="top-right" />
      <Sidebar user={user} className="w-72" />
      <main className="flex-1 p-6 max-w-full">
        <Header user={user} />
        <div className="bg-[color:var(--sprada-card)] rounded-2xl shadow-[var(--shadow-1)] p-5">
          <UsersAdmin />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------
   Header
   --------------------------- */
function Header({ user }) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <img src={LOGO} alt="Sprada" className="w-36 object-contain" />
          <div>
            <h1 className="text-2xl sprada-heading font-semibold text-[color:var(--sprada-accent)]">Users</h1>
            <div className="text-sm text-[color:var(--sprada-muted)]">Manage application users, roles & security</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-[color:var(--sprada-muted)]">Signed in as</div>
        <div className="px-3 py-2 bg-white border rounded-lg shadow-sm text-sm">{user?.full_name || user?.name || "Admin"}</div>
      </div>
    </header>
  );
}

/* ---------------------------
   UsersAdmin component (list + actions)
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
      // support multiple shapes, normalizing to { users, total }
      if (Array.isArray(res)) {
        setUsers(res);
        setTotal(res.length);
      } else if (res.users && Array.isArray(res.users)) {
        setUsers(res.users);
        setTotal(typeof res.total === "number" ? res.total : res.users.length);
      } else if (res.data && Array.isArray(res.data.users)) {
        setUsers(res.data.users);
        setTotal(res.data.total || res.data.users.length);
      } else if (res.ok && Array.isArray(res.users)) {
        setUsers(res.users);
        setTotal(res.total || res.users.length);
      } else {
        // fallback: try to extract array-like
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
      // optimistic update
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
      // refresh single item in list (or reload)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">User management</h3>
          <p className="text-xs text-[color:var(--sprada-muted)]">Create, edit and manage application users</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search by name or email..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-4 pr-3 py-2 border rounded-lg w-64 focus-ring"
            aria-label="Search users"
          />
          <button onClick={openCreate} className="px-4 py-2 rounded bg-[color:var(--sprada-accent)] text-white shadow hover:shadow-md transition transform active:scale-95">Create user</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm text-[color:var(--sprada-muted)]">Showing {users.length} users</div>
          <div className="text-xs text-slate-400">Total: {total ?? users.length}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
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
              {loading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-10" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-8 bg-gray-100 rounded w-24 inline-block" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--sprada-muted)]">No users found</td>
                </tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">{u.full_name || "—"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role_id === 1 ? "Admin" : u.role_id === 2 ? "Editor" : `Role ${u.role_id}`}</td>
                  <td className="px-4 py-3">{u.is_active ? <span className="text-green-600">Yes</span> : <span className="text-red-500">No</span>}</td>
                  <td className="px-4 py-3">{u.created_at ? dayjs(u.created_at).format("D MMM YYYY") : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50 transition">Edit</button>
                      <button disabled={busyActionId === u.id} onClick={() => handleToggleActive(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50 transition">
                        {busyActionId === u.id ? "…" : (u.is_active ? "Deactivate" : "Activate")}
                      </button>
                      <button disabled={busyActionId === u.id} onClick={() => handleChangePassword(u)} className="px-2 py-1 border rounded text-xs hover:bg-slate-50 transition">Pwd</button>
                      <button disabled={busyActionId === u.id} onClick={() => handleDelete(u)} className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

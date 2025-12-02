// src/pages/LeadsPage.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import LOGO from "../assets/SPRADA_LOGO.png";
import toast, { Toaster } from "react-hot-toast";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getCategories,
} from "../lib/api";
import dayjs from "dayjs";
import {
  X,
  Mail,
  Phone,
  Building2,
  MapPin,
  Flag,
  MessageSquare,
  PlusCircle,
  Trash2,
  Edit2,
} from "lucide-react";

/* ------------------------------------------
   Helpers & constants
------------------------------------------- */
const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "in_progress", label: "In Progress" },
  { value: "won", label: "Converted (Won)" },
  { value: "lost", label: "Lost" },
];

function getStatusColor(status) {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";
    case "contacted":
      return "bg-amber-100 text-amber-700";
    case "in_progress":
      return "bg-purple-100 text-purple-700";
    case "won":
      return "bg-green-100 text-green-700";
    case "lost":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/* ------------------------------------------
   Lead Detail Modal with notes
------------------------------------------- */
function LeadDetailModal({ open, lead, onClose, onStatusChange, onLeadUpdated }) {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    let mounted = true;
    setLoadingNotes(true);
    apiGet(`/leads/${lead.id}/notes`)
      .then((res) => {
        if (!mounted) return;
        setNotes(res.notes || []);
      })
      .catch(() => setNotes([]))
      .finally(() => mounted && setLoadingNotes(false));
    return () => { mounted = false; };
  }, [open, lead]);

  if (!open || !lead) return null;

  async function addNote() {
    if (!note.trim()) return;
    const txt = note.trim();
    setNote("");
    try {
      const res = await apiPost(`/leads/${lead.id}/notes`, { note: txt });
      if (res?.note) setNotes((p) => [res.note, ...p]);
      toast.success("Note added");
    } catch (e) {
      console.error("add note", e);
      toast.error("Failed to add note");
    }
  }

  async function changeStatus(newStatus) {
    setBusyStatus(true);
    try {
      const res = await apiPut(`/leads/${lead.id}`, { status: newStatus });
      if (res?.lead) {
        onStatusChange && onStatusChange(lead.id, newStatus);
        onLeadUpdated && onLeadUpdated(res.lead);
      } else {
        onStatusChange && onStatusChange(lead.id, newStatus);
      }
      toast.success("Status updated");
    } catch (e) {
      console.error("status update", e);
      toast.error("Failed to update status");
    } finally {
      setBusyStatus(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 z-10 overflow-auto max-h-[90vh] transform transition-all duration-300 scale-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold sprada-heading">{lead.name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Lead Info */}
        <div className="space-y-3 border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-sprada3" />
            <div>{lead.email}</div>
          </div>
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-sprada3" />
              <div>{lead.phone}</div>
            </div>
          )}
          {lead.company && (
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-sprada3" />
              <div>{lead.company}</div>
            </div>
          )}
          {lead.country && (
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-sprada3" />
              <div>{lead.country}</div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-sprada3" />
            <div>{lead.product_interest || "—"}</div>
          </div>

          <div className="mt-2 p-3 bg-white border rounded-lg">
            <div className="text-sm text-slate-500 mb-1">Message</div>
            <div className="text-sm">{lead.message || "—"}</div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-slate-500">Status:</span>
            <select
              className="ml-3 border rounded px-2 py-1"
              value={lead.status}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={busyStatus}
            >
              {STATUS_OPTIONS.map((s) => (
                <option value={s.value} key={s.value}>{s.label}</option>
              ))}
            </select>
            <div className={`px-2 py-1 rounded text-xs ${getStatusColor(lead.status)}`}>
              {STATUS_OPTIONS.find(s => s.value === lead.status)?.label}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <MessageSquare size={18} /> Timeline Notes
          </h3>

          <div className="space-y-3 max-h-60 overflow-auto border p-3 rounded-lg bg-gray-50">
            {loadingNotes ? (
              <div className="text-sm text-slate-500">Loading notes…</div>
            ) : notes.length === 0 ? (
              <div className="text-sm text-slate-500">No notes added</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-2 bg-white border rounded shadow-sm">
                  <div className="text-xs text-slate-500">
                    {dayjs(n.created_at).format("DD MMM YYYY, hh:mm A")}
                  </div>
                  <div className="text-sm">{n.note}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 border rounded px-3 py-2"
            />
            <button onClick={addNote} className="px-4 py-2 bg-sprada3 text-white rounded-lg">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------
   Lead Form Modal (styled like Products.jsx)
   - uses categories for product interest dropdown
------------------------------------------- */
function LeadFormModal({ open, initial = null, onClose, onSaved }) {
  const isEdit = Boolean(initial && initial.id);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    country: "",
    product_interest: "",
    message: "",
    status: "new",
  });

  useEffect(() => {
    // load categories for dropdown
    let mounted = true;
    getCategories().then((c) => {
      if (!mounted) return;
      // getCategories may return array or { categories: [...] }
      const arr = Array.isArray(c) ? c : (c?.categories || []);
      setCategories(arr);
    }).catch(() => setCategories([]));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (open) {
      if (isEdit) {
        setForm({
          name: initial.name || "",
          email: initial.email || "",
          phone: initial.phone || "",
          company: initial.company || "",
          country: initial.country || "",
          product_interest: initial.product_interest || "",
          message: initial.message || "",
          status: initial.status || "new",
        });
      } else {
        setForm({
          name: "",
          email: "",
          phone: "",
          company: "",
          country: "",
          product_interest: "",
          message: "",
          status: "new",
        });
      }
    }
  }, [open, initial, isEdit]);

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.name || !form.email) {
      toast.error("Name & email are required");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        const res = await apiPut(`/leads/${encodeURIComponent(initial.id)}`, form);
        toast.success("Lead updated");
        onSaved && onSaved(res.lead || { ...initial, ...form });
      } else {
        const res = await apiPost("/leads", form);
        toast.success("Lead created");
        onSaved && onSaved(res.lead || res);
      }
      onClose && onClose();
    } catch (e) {
      console.error("save lead", e);
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!busy) onClose(); }} />

      <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-4xl p-6 z-10 transform transition-all duration-300 hover:shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-24 object-contain" />
            <h3 className="sprada-heading font-semibold text-lg">{isEdit ? "Edit Lead" : "Create Lead"}</h3>
          </div>

          <div>
            <button className="px-3 py-2 border rounded-lg mr-2" onClick={() => onClose()} disabled={busy}><X /></button>
            <button className="px-4 py-2 bg-[color:var(--sprada-accent)] text-white rounded-lg shadow hover:shadow-md" onClick={save} disabled={busy}>
              {busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save" : "Create")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Name</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Email</label>
            <input value={form.email} onChange={(e) => setField("email", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Phone</label>
            <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Company</label>
            <input value={form.company} onChange={(e) => setField("company", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Country</label>
            <input value={form.country} onChange={(e) => setField("country", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Product interest (category)</label>
            <select value={form.product_interest || ""} onChange={(e) => setField("product_interest", e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white">
              <option value="">-- select category --</option>
              {categories.map(c => <option key={c.id} value={c.name || c.slug || c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-[color:var(--sprada-muted)]">Message</label>
            <textarea value={form.message} onChange={(e) => setField("message", e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={4} />
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Status</label>
            <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full border rounded-lg px-3 py-2">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------
   Leads Page — Main
------------------------------------------- */
export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  // modals
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  // paging
  const [page, setPage] = useState(1);
  const limit = 50;

  async function load() {
    setLoading(true);
    try {
      const qs = [];
      if (q) qs.push(`q=${encodeURIComponent(q)}`);
      if (status && status !== "all") qs.push(`status=${encodeURIComponent(status)}`);
      qs.push(`page=${page}`);
      qs.push(`limit=${limit}`);
      const query = qs.length ? `?${qs.join("&")}` : "";
      const res = await apiGet(`/leads${query}`);
      setLeads(res.leads || []);
    } catch (e) {
      console.error("load leads", e);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  const filtered = leads.filter((l) => {
    if (status !== "all" && l.status !== status) return false;
    if (q && !String(l.name || l.email || l.company).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function openLead(l) {
    setSelectedLead(l);
    setDetailOpen(true);
  }

  function openCreateForm() {
    setFormInitial(null);
    setFormOpen(true);
  }

  function openEditForm(lead, e) {
    e?.stopPropagation?.();
    setFormInitial(lead);
    setFormOpen(true);
  }

  async function handleSaveFromForm(savedLead) {
    await load();
  }

  async function handleDelete(lead, e) {
    e?.stopPropagation?.();
    if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/leads/${encodeURIComponent(lead.id)}`);
      setLeads((p) => p.filter((x) => x.id !== lead.id));
      toast.success("Lead deleted");
    } catch (err) {
      console.error("delete lead", err);
      toast.error("Delete failed");
    }
  }

  function updateStatusLocally(id, newStatus) {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    setDetailOpen(false);
  }

  function updateLeadLocally(updated) {
    setLeads((p) => p.map((l) => (l.id === updated.id ? updated : l)));
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Toaster position="top-right" />
      <Sidebar className="w-72" user={JSON.parse(localStorage.getItem("user") || "{}")} />

      <main className="flex-1 p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="" className="w-28" />
            <div>
              <h1 className="text-2xl sprada-heading font-medium text-sprada3">Leads Manager</h1>
              <p className="text-sm text-slate-500">Track client inquiries & status updates</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={openCreateForm} className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5">
              <PlusCircle className="w-5 h-5 text-sprada3" /> Add Lead
            </button>
            <button onClick={load} className="px-4 py-2 bg-sprada3 text-white rounded-lg">Refresh</button>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow mb-6 flex flex-col md:flex-row gap-4 items-center">
          <input
            className="px-3 py-2 border rounded-lg w-full md:w-1/3 transition focus:shadow-outline"
            placeholder="Search name / email / company..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />

          <select
            className="px-3 py-2 border rounded-lg"
            value={status}
            onChange={(e) => { setStatus(e.target.value); }}
          >
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs text-slate-500">Page:</div>
            <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <div className="px-2">{page}</div>
            <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Email</th>
                <th className="text-left">Country</th>
                <th className="text-left">Interest</th>
                <th className="text-left">Status</th>
                <th className="text-right">Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-6 text-center">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">No leads</td></tr>
              ) : (
                filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => openLead(l)}
                  >
                    <td className="py-3">{l.name}</td>
                    <td>{l.email}</td>
                    <td>{l.country || "—"}</td>
                    <td>{l.product_interest || "—"}</td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(l.status)}`}>
                        {STATUS_OPTIONS.find(s => s.value === l.status)?.label || l.status}
                      </span>
                    </td>
                    <td className="text-right">{dayjs(l.created_at).format("DD MMM YYYY")}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={(e) => openEditForm(l, e)} className="px-2 py-1 border rounded hover:bg-slate-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => handleDelete(l, e)} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        {detailOpen && selectedLead && (
          <LeadDetailModal
            open={detailOpen}
            lead={selectedLead}
            onClose={() => setDetailOpen(false)}
            onStatusChange={updateStatusLocally}
            onLeadUpdated={updateLeadLocally}
          />
        )}

        {formOpen && (
          <LeadFormModal
            open={formOpen}
            initial={formInitial}
            onClose={() => setFormOpen(false)}
            onSaved={async (saved) => { await handleSaveFromForm(saved); }}
          />
        )}
      </main>
    </div>
  );
}

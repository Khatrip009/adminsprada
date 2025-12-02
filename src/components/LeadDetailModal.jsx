import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { getLeadById, getLeadNotes, addLeadNote, updateLead } from "../lib/api";

/**
 * Props:
 * - leadId (id string)
 * - open (bool)
 * - onClose (fn)
 */
export default function LeadDetailModal({ leadId, open = true, onClose = () => {} }) {
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || !leadId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const ld = await getLeadById(leadId);
        if (!mounted) return;
        setLead(ld?.lead || ld || null);
        setStatus((ld?.lead && ld.lead.status) || ld?.status || "");
      } catch (err) {
        console.error("getLeadById", err);
        toast.error("Failed loading lead");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    (async () => {
      try {
        const r = await getLeadNotes(leadId);
        // backend returns { ok:true, notes: [...] }
        setNotes(r?.notes || r || []);
      } catch (err) {
        console.warn("getLeadNotes", err);
        setNotes([]);
      }
    })();

    return () => { mounted = false; };
  }, [leadId, open]);

  async function handleAddNote() {
    if (!noteText || !noteText.trim()) return toast.error("Note cannot be empty");
    setBusy(true);
    try {
      // backend expects { note: '...' }
      await addLeadNote(leadId, { note: noteText.trim() });
      setNoteText("");
      // reload notes
      const r = await getLeadNotes(leadId);
      setNotes(r?.notes || r || []);
      toast.success("Note added");
    } catch (err) {
      console.error(err);
      toast.error("Add note failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!lead) return;
    setBusy(true);
    try {
      await updateLead(leadId, { status: newStatus });
      setStatus(newStatus);
      setLead(prev => ({ ...prev, status: newStatus }));
      toast.success("Status updated");
    } catch (err) {
      console.error(err);
      toast.error("Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 z-10 overflow-auto max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="sprada-heading text-lg font-semibold">{lead?.name || lead?.email || "Lead detail"}</h3>
            <div className="text-sm text-slate-500">{lead?.company || lead?.phone || lead?.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <select value={status || ""} onChange={e => handleStatusChange(e.target.value)} className="border rounded px-3 py-2">
              <option value="">Set status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
            <button onClick={onClose} className="px-3 py-2 border rounded-lg">Close</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="mb-4">
              <div className="text-sm text-slate-500">Message</div>
              <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{lead?.message}</div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold mb-2">Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div><strong>Name:</strong> {lead?.name}</div>
                <div><strong>Email:</strong> {lead?.email}</div>
                <div><strong>Phone:</strong> {lead?.phone}</div>
                <div><strong>Country:</strong> {lead?.country}</div>
                <div><strong>Company:</strong> {lead?.company}</div>
                <div><strong>Interest:</strong> {lead?.product_interest || lead?.productInterest || lead?.product}</div>
                <div><strong>Created:</strong> {lead?.created_at ? dayjs(lead.created_at).format("D MMM YYYY, h:mm A") : ""}</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Timeline</h4>
              <div className="space-y-3 max-h-60 overflow-auto p-2 border rounded">
                {notes.length === 0 ? <div className="text-slate-500 text-sm">No notes</div> : notes.map(n => (
                  <div key={n.id || n.created_at} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>{n.author_name || n.author || "System"}</div>
                      <div>{n.created_at ? dayjs(n.created_at).format("D MMM, h:mm A") : ""}</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{n.note ?? n.body ?? ""}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." className="w-full border rounded p-2 min-h-[80px]" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-500">Notes are visible to admins only</div>
                  <div className="flex items-center gap-2">
                    <button disabled={busy} onClick={() => setNoteText("")} className="px-3 py-1 border rounded text-xs">Clear</button>
                    <button disabled={busy} onClick={handleAddNote} className="px-3 py-1 bg-[#0f6b5a] text-white rounded text-xs">{busy ? "Saving…" : "Add note"}</button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <aside className="p-3 border rounded-lg">
            <div className="text-sm text-slate-500 mb-3">Quick info</div>
            <div className="text-sm"><strong>Status:</strong> <span className="ml-2">{status || lead?.status || "—"}</span></div>
            <div className="text-sm mt-2"><strong>Source:</strong> <span className="ml-2">{lead?.source || "contact form"}</span></div>
            <div className="text-sm mt-2"><strong>Assigned:</strong> <span className="ml-2">{lead?.assigned_to_name || lead?.assigned_to || "Unassigned"}</span></div>

            <div className="mt-4">
              <button onClick={() => handleStatusChange("contacted")} className="w-full px-3 py-2 border rounded mb-2 text-sm">Mark Contacted</button>
              <button onClick={() => handleStatusChange("qualified")} className="w-full px-3 py-2 border rounded mb-2 text-sm">Mark Qualified</button>
              <button onClick={() => handleStatusChange("converted")} className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm">Mark Converted</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

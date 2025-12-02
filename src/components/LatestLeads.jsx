// src/components/LatestLeads.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { apiGet } from "../lib/api";
import { Bell } from "lucide-react";

export default function LatestLeads({ max = 5 }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(`/leads?limit=${max}`);
      setLeads(res.leads || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-sprada2" />
          <div className="text-sm font-medium">Latest Leads</div>
        </div>
        <button onClick={() => navigate('/dashboard/leads')} className="text-xs px-2 py-1 border rounded">Manage</button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: max }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-sm text-slate-500">No leads yet</div>
      ) : (
        <div className="space-y-2">
          {leads.map(l => (
            <div key={l.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/dashboard/leads` /* Leads page will show detail */)}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{l.name} <span className="text-xs text-slate-400">· {l.email}</span></div>
                <div className="text-xs text-slate-500 truncate">{l.product_interest || l.company || l.country || '-'}</div>
              </div>
              <div className="text-xs text-slate-400">{dayjs(l.created_at).format('DD MMM')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

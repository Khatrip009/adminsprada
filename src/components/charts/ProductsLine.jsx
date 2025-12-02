// src/components/ProductsLine.jsx
import React, { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getProducts } from "../../lib/api";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function ProductsLine({ months = 6 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // group products by month (created_at)
  async function load() {
    setLoading(true);
    try {
      // fetch many products (adjust limit as needed)
      const res = await getProducts({ page: 1, limit: 1000 });
      const items = Array.isArray(res) ? res : (res?.products || res?.data || []);
      // prepare buckets for last `months` months
      const now = dayjs();
      const buckets = [];
      for (let i = months - 1; i >= 0; i--) {
        const m = now.subtract(i, "month");
        const key = m.format("YYYY-MM");
        buckets.push({ key, label: m.format("MMM YYYY"), count: 0 });
      }
      // assign products
      (items || []).forEach(p => {
        const created = p.created_at || p.createdAt || p.created;
        if (!created) return;
        const k = dayjs(created).format("YYYY-MM");
        const b = buckets.find(x => x.key === k);
        if (b) b.count++;
      });
      setData(buckets.map(b => ({ name: b.label, count: b.count })));
    } catch (err) {
      console.error("ProductsLine load", err);
      toast.error("Failed to load products");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-3"></div>
        <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="text-sm text-sprada3 dark:text-slate-300">Trends</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products created</div>
        <div className="py-8 text-center text-slate-500 dark:text-slate-400">No data</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
      <div className="mb-2">
        <div className="text-sm text-sprada3 dark:text-slate-300">Trends</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products created (last {months} months)</div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? "#1f2937" : "#eaeef0"} />
            <XAxis dataKey="name" tick={{ fill: document.documentElement.classList.contains('dark') ? "#cbd5e1" : "#6b6b6b" }} />
            <YAxis tick={{ fill: document.documentElement.classList.contains('dark') ? "#cbd5e1" : "#6b6b6b" }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0f6b5a" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

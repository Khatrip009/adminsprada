// src/components/ProductsBar.jsx
import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import { getCategories } from "../../lib/api";
import toast from "react-hot-toast";

export default function ProductsBar({ top = 5 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getCategories(); // api helper should call /categories?include_counts=true
      // support shapes: { categories: [...] } or array
      const cats = Array.isArray(res) ? res : (res?.categories || res?.data || []);
      const arr = (cats || []).map(c => ({
        id: c.id,
        name: c.name || c.slug || "—",
        count: (c.product_count != null) ? Number(c.product_count) : 0
      }));
      // sort desc
      arr.sort((a,b) => b.count - a.count);
      setData(arr.slice(0, top));
    } catch (err) {
      console.error("ProductsBar load", err);
      toast.error("Failed to load category counts");
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
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
        <div className="h-44 bg-gray-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="text-sm text-sprada3 dark:text-slate-300">Top categories</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products by category</div>
        <div className="py-8 text-center text-slate-500 dark:text-slate-400">No category data</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
      <div className="mb-2">
        <div className="text-sm text-sprada3 dark:text-slate-300">Top categories</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products by category</div>
      </div>

      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? "#1f2937" : "#eaeef0"} />
            <XAxis dataKey="name" tick={{ fill: document.documentElement.classList.contains('dark') ? "#cbd5e1" : "#6b6b6b" }} />
            <YAxis tick={{ fill: document.documentElement.classList.contains('dark') ? "#cbd5e1" : "#6b6b6b" }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0f6b5a" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

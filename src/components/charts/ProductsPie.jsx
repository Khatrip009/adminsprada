// src/components/ProductsPie.jsx
import React, { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { getCategories } from "../../lib/api";
import toast from "react-hot-toast";

const COLORS = ["#1A6560","#0f6b5a","#0b8f6b","#16a34a","#84cc16","#f59e0b","#f97316","#ef4444","#8b5cf6","#0ea5e9"];

export default function ProductsPie({ top = 8 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getCategories();
      const cats = Array.isArray(res) ? res : (res?.categories || []);
      const arr = (cats || []).map(c => ({ name: c.name || c.slug, value: Number(c.product_count || 0) }));
      arr.sort((a,b) => b.value - a.value);
      const topArr = arr.slice(0, top);
      const rest = arr.slice(top).reduce((s, x) => s + (x.value || 0), 0);
      if (rest > 0) topArr.push({ name: "Other", value: rest });
      setData(topArr);
    } catch (err) {
      console.error("ProductsPie load", err);
      toast.error("Failed to load categories");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-3"></div>
        <div className="h-44 bg-gray-100 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="text-sm text-sprada3 dark:text-slate-300">Category share</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products distribution</div>
        <div className="py-8 text-center text-slate-500 dark:text-slate-400">No data</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-800">
      <div className="mb-2">
        <div className="text-sm text-sprada3 dark:text-slate-300">Category share</div>
        <div className="text-lg font-bold text-sprada2 dark:text-white">Products distribution</div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
              {data.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

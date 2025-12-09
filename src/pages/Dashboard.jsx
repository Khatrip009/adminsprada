// src/pages/DashboardPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Charts (wired to the new chart components)
import VisitorsTrend from "../components/charts/VisitorsTrend";
import ReviewsDonut from "../components/charts/ReviewsDonut";
import ProductsBar from "../components/charts/ProductsBar";
import ProductsDonut from "../components/charts/ProductsDonut";
import ProductsLine from "../components/charts/ProductsLine";
import ProductsPie from "../components/charts/ProductsPie";

import LatestProducts from "../components/LatestProducts";
import LatestBlogs from "../components/LatestBlogs";
import PushList from "../components/PushList";
import VisitorSessions from "../components/VisitorSessions";
import MetricCard from "../components/MetricCard";
import MetricCardLeads from "../components/MetricCardLeads";
import LatestLeads from "../components/LatestLeads";

import useDashboardData from "../hooks/useDashboardData";
import useSSE from "../hooks/useSSE";
import useLeadsStats from "../hooks/useLeadsStats";

import { API_ORIGIN, getCategories } from "../lib/api"; // canonical API origin + helper

// icon
import { Users } from "lucide-react";

/**
 * DashboardPage
 *
 * Responsive, defensive, and ready to paste.
 */

export default function DashboardPage() {
  const {
    loading,
    visitors,
    reviewsStats,
    categories,
    products,
    blogs,
    home,
    visits,
    push,
  } = useDashboardData() || {};

  const leadsStats = useLeadsStats() || {};

  // mobile sidebar toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // SSE: use the canonical API origin from lib/api to avoid env mismatches
  const sseBase = (API_ORIGIN || "").replace(/\/$/, "");
  const sseUrl = sseBase ? `${sseBase}/api/events/sse` : "/api/events/sse";
  const { connected, events } = useSSE(sseUrl) || { connected: false, events: [] };

  // Topbar height → CSS variable
  const topbarRef = useRef(null);
  useEffect(() => {
    const DEFAULT_HEADER = 72;
    let mounted = true;

    const measure = () => {
      try {
        const el = topbarRef.current || document.querySelector(".app-topbar");
        const h = el && el.offsetHeight ? el.offsetHeight : DEFAULT_HEADER;
        if (mounted) {
          document.documentElement.style.setProperty("--app-header-height", `${h}px`);
        }
      } catch {
        if (mounted) {
          document.documentElement.style.setProperty("--app-header-height", `${DEFAULT_HEADER}px`);
        }
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => {
      mounted = false;
      window.removeEventListener("resize", measure);
    };
  }, []);

  // ---------- Prepare chart data (defensive) ----------

  // VisitorsTrend: prefer visitors.trend (array of { date, count }) then visits
  const visitorsTrendData =
    (visitors && Array.isArray(visitors.trend) && visitors.trend) ||
    (Array.isArray(visits)
      ? visits
          .slice()
          .reverse()
          .reduce((acc, v) => {
            const ts = v?.ts || v?.created_at || Date.now();
            const d = new Date(ts).toISOString().slice(0, 10);
            const idx = acc.findIndex((x) => x.date === d);
            if (idx >= 0) acc[idx].count = (acc[idx].count || 0) + 1;
            else acc.push({ date: d, count: 1 });
            return acc;
          }, [])
      : null) ||
    null;

  // ReviewsDonut: accept reviewsStats.distribution or ratings object
  let reviewsDonutData = null;
  if (reviewsStats) {
    if (Array.isArray(reviewsStats.distribution) && reviewsStats.distribution.length) {
      reviewsDonutData = reviewsStats.distribution;
    } else if (reviewsStats.ratings && typeof reviewsStats.ratings === "object") {
      reviewsDonutData = Object.entries(reviewsStats.ratings).map(([k, v]) => ({
        name: k,
        value: Number(v) || 0,
      }));
    } else if (typeof reviewsStats.total === "number") {
      const avg = Number(reviewsStats.avg_rating || 0);
      const total = Number(reviewsStats.total || 0);
      const five = Math.round(total * Math.min(1, Math.max(0, (avg - 3) / 2)));
      const rest = Math.max(0, total - five);
      reviewsDonutData = [
        { name: "5", value: five },
        { name: "1-4", value: rest },
      ];
    }
  }

  // ---------- Products by category (attempt to use backend counts, fallback to products, then mock) ----------
  const [productsByCategory, setProductsByCategory] = useState(null);
  const [productsByCategoryIsMock, setProductsByCategoryIsMock] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function buildProductsByCategory() {
      const mapCategories = (cats = []) =>
        cats.map((c) => ({
          name: c.name || c.slug || "—",
          count: Number(c.product_count ?? c.productCount ?? 0) || 0,
          id: c.id,
        }));

      // 1) If categories provided by hook and contain counts, use them
      if (Array.isArray(categories) && categories.length) {
        const mapped = mapCategories(categories);
        const hasCounts = mapped.some((m) => Number(m.count) > 0);
        if (hasCounts) {
          if (!mounted) return;
          setProductsByCategory(mapped);
          setProductsByCategoryIsMock(false);
          return;
        }
        // categories exist but counts are zero/missing — attempt to fetch fresh categories with counts
      }

      // 2) Try to fetch categories from backend (include_counts=true)
      try {
        const fetched = await getCategories();
        let cats = Array.isArray(fetched) ? fetched : (fetched?.categories || fetched?.data || fetched);
        if (!Array.isArray(cats) && cats && cats.items) cats = cats.items;
        if (Array.isArray(cats) && cats.length) {
          const mapped = mapCategories(cats);
          const hasCounts = mapped.some((m) => Number(m.count) > 0);
          if (hasCounts) {
            if (!mounted) return;
            setProductsByCategory(mapped);
            setProductsByCategoryIsMock(false);
            return;
          }
        }
      } catch (err) {
        // non-fatal; continue to derive/fallback
      }

      // 3) Derive from products array if available
      if (Array.isArray(products) && products.length) {
        const byCat = {};
        products.forEach((prod) => {
          const name =
            (prod?.category && (prod.category.name || prod.category.slug)) ||
            (prod.category_id ? `Category ${prod.category_id}` : "Uncategorized");
          byCat[name] = (byCat[name] || 0) + 1;
        });
        const arr = Object.entries(byCat).map(([name, count]) => ({ name, count }));
        if (!mounted) return;
        setProductsByCategory(arr);
        setProductsByCategoryIsMock(false);
        return;
      }

      // 4) Final fallback: demo/mock
      if (!mounted) return;
      setProductsByCategory([
        { name: "Cardamom", count: 120 },
        { name: "Spices", count: 90 },
        { name: "Seeds", count: 60 },
        { name: "Napier", count: 45 },
        { name: "Others", count: 30 },
      ]);
      setProductsByCategoryIsMock(true);
    }

    buildProductsByCategory();
    return () => {
      mounted = false;
    };
  }, [categories, products]);

  // ProductsLine: produce a timeseries if products have created_at, else null
  let productsLineData = null;
  if (Array.isArray(products) && products.length) {
    const byDay = {};
    products.forEach((p) => {
      const d = new Date(p.created_at || Date.now()).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    });
    productsLineData = Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  // Ensure donut data is an array or null
  if (reviewsDonutData && !Array.isArray(reviewsDonutData)) reviewsDonutData = null;

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="p-10 text-center text-sprada3">Loading dashboard…</div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-white to-sprada1/50">
      {/* Sidebar (desktop) */}
      <div className="hidden lg:block w-72">
        <Sidebar user={JSON.parse(localStorage.getItem("user") || "{}")} />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white p-4 overflow-auto shadow-2xl">
            <Sidebar user={JSON.parse(localStorage.getItem("user") || "{}")} />
            <div className="mt-4">
              <button onClick={() => setMobileSidebarOpen(false)} className="px-3 py-2 border rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Topbar (fixed) */}
        <div ref={topbarRef} className="app-topbar fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur">
          <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        </div>

        {/* Small-screen hamburger (fallback) */}
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed top-3 left-3 z-[60] inline-flex items-center justify-center w-10 h-10 rounded-md bg-white/90 shadow border"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect y="0.5" width="18" height="2" rx="1" fill="#0F172A"/>
            <rect y="6" width="18" height="2" rx="1" fill="#0F172A"/>
            <rect y="11.5" width="18" height="2" rx="1" fill="#0F172A"/>
          </svg>
        </button>

        {/* Main content */}
        <main className="p-4 md:p-6 lg:p-8 pt-[var(--app-header-height,72px)]">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-2xl font-bold text-sprada2">Dashboard</h3>
              <p className="text-sm text-sprada2/70">Business metrics & live activities</p>
            </div>

            <div className="flex items-center gap-3 text-sm text-sprada2/70">
              <div>
                Realtime:{" "}
                {connected ? (
                  <span className="text-green-600">connected</span>
                ) : (
                  <span className="text-red-500">offline</span>
                )}
              </div>
              <div className="px-3 py-1 bg-white/50 rounded-lg border">
                {(events && events.length) || 0} events
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Visitors"
              value={visitors?.total_visitors ?? 0}
              delta={visitors?.visitors_today ? `Today ${visitors.visitors_today}` : null}
              icon="👁️"
            />

            <MetricCard
              title="Visitors Today"
              value={visitors?.visitors_today ?? 0}
              delta={visitors?.new_visitors_today ? `New ${visitors.new_visitors_today}` : null}
              icon="📈"
            />

            <MetricCard title="Products" value={Array.isArray(products) ? products.length : (products?.length ?? 0)} delta={null} icon="📦" />

            <MetricCard
              title="Avg Rating"
              value={reviewsStats?.avg_rating ?? "0.0"}
              delta={reviewsStats?.total ? `${reviewsStats.total} reviews` : null}
              icon="⭐"
            />

            <MetricCardLeads
              title="New Leads"
              value={leadsStats?.total ?? 0}
              delta={
                typeof leadsStats?.delta === "number"
                  ? (leadsStats.delta >= 0 ? `+${leadsStats.delta}` : `${leadsStats.delta}`)
                  : "+0"
              }
              icon={<Users className="w-6 h-6 text-sprada4/90" />}
            />

            <MetricCard
              title="New Leads (Today)"
              value={leadsStats?.today ?? 0}
              delta={typeof leadsStats?.todayDelta === "number" ? (leadsStats.todayDelta >= 0 ? `+${leadsStats.todayDelta}` : `${leadsStats.todayDelta}`) : "+0"}
              icon="📨"
            />
          </div>

          {/* Charts layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            {/* Left: visitors + main charts */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <VisitorsTrend data={visitorsTrendData || []} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <ReviewsDonut distribution={reviewsDonutData || []} />
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <ProductsBar data={productsByCategory || []} />
                  {productsByCategoryIsMock && (
                    <div className="text-xs text-amber-600 mt-1">Using demo category data — backend categories/products not available.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <ProductsDonut data={productsByCategory || []} />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <ProductsPie data={productsByCategory || []} />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <ProductsLine data={productsLineData || []} />
                </div>
              </div>
            </div>

            {/* Right column: lists */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <LatestProducts items={products || []} />
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <LatestBlogs items={Array.isArray(blogs) ? blogs : []} max={5} />
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <LatestLeads max={5} />
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <PushList items={push || []} />
              </div>
            </div>
          </div>

          {/* Sessions + feed */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <VisitorSessions items={visits || []} />
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm text-sprada3 font-medium mb-3">Activity Feed</div>

              <div className="text-sm text-sprada2/70">
                {(!events || events.length === 0)
                  ? "No live events — SSE not configured server-side."
                  : events.slice(0, 50).map((e, i) => (
                      <div key={i} className="py-2 border-t first:border-t-0">
                        <div className="text-xs text-sprada2/80">
                          {e.type || e.event || "event"} • {new Date(e.ts || Date.now()).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-sprada2">
                          {e.msg || (e.payload ? JSON.stringify(e.payload) : JSON.stringify(e))}
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

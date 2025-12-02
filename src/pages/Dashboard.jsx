// src/pages/DashboardPage.jsx
import React, { useEffect, useRef } from "react";
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

// icon
import { Users } from "lucide-react";

/**
 * DashboardPage (wired to the full set of product/category charts)
 * - visitors trend
 * - reviews donut
 * - products: bar, donut, pie, line
 *
 * The components receive best-effort data shapes derived from useDashboardData()
 * so they won't crash if the backend shape varies slightly.
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
  } = useDashboardData();

  const leadsStats = useLeadsStats();

  // SSE
  const sseUrl =
    (import.meta.env.VITE_API_BASE || "http://localhost:4200") +
    "/api/events/sse";

  const { connected, events } = useSSE(sseUrl);

  // Topbar height → CSS variable
  const topbarRef = useRef(null);
  useEffect(() => {
    const DEFAULT_HEADER = 72;

    const measure = () => {
      try {
        const el = topbarRef.current || document.querySelector(".app-topbar");
        if (el && el.offsetHeight) {
          document.documentElement.style.setProperty(
            "--app-header-height",
            `${el.offsetHeight}px`
          );
        } else {
          document.documentElement.style.setProperty(
            "--app-header-height",
            `${DEFAULT_HEADER}px`
          );
        }
      } catch {
        document.documentElement.style.setProperty(
          "--app-header-height",
          `${DEFAULT_HEADER}px`
        );
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
            const d = new Date(v.ts || v.created_at || Date.now())
              .toISOString()
              .slice(0, 10);
            const idx = acc.findIndex((x) => x.date === d);
            if (idx >= 0) acc[idx].count++;
            else acc.push({ date: d, count: 1 });
            return acc;
          }, [])
      : null) ||
    null;

  // ReviewsDonut: accept reviewsStats.distribution or ratings object
  let reviewsDonutData = null;
  if (reviewsStats) {
    if (Array.isArray(reviewsStats.distribution)) {
      reviewsDonutData = reviewsStats.distribution;
    } else if (reviewsStats.ratings && typeof reviewsStats.ratings === "object") {
      reviewsDonutData = Object.entries(reviewsStats.ratings).map(([k, v]) => ({
        name: k,
        value: Number(v) || 0,
      }));
    } else if (typeof reviewsStats.total === "number") {
      // gentle fallback: spread total across buckets based on avg_rating
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

  // Products charts: build buckets from categories.product_count or compute from products
  let productsByCategory = null;
  if (Array.isArray(categories) && categories.length) {
    productsByCategory = categories.map((c) => ({
      name: c.name || c.slug || "—",
      count: Number(c.product_count ?? c.productCount ?? 0) || 0,
      id: c.id,
    }));

    const allZero = productsByCategory.every((p) => p.count === 0);
    if (allZero && Array.isArray(products) && products.length) {
      const byCat = {};
      products.forEach((prod) => {
        const name =
          (prod.category && (prod.category.name || prod.category.slug)) ||
          "Uncategorized";
        byCat[name] = (byCat[name] || 0) + 1;
      });
      productsByCategory = Object.entries(byCat).map(([name, count]) => ({
        name,
        count,
      }));
    }
  } else if (Array.isArray(products) && products.length) {
    const byCat = {};
    products.forEach((prod) => {
      const name =
        (prod.category && (prod.category.name || prod.category.slug)) ||
        "Uncategorized";
      byCat[name] = (byCat[name] || 0) + 1;
    });
    productsByCategory = Object.entries(byCat).map(([name, count]) => ({
      name,
      count,
    }));
  } else {
    // graceful demo fallback
    productsByCategory = [
      { name: "Cardamom", count: 120 },
      { name: "Spices", count: 90 },
      { name: "Seeds", count: 60 },
      { name: "Napier", count: 45 },
      { name: "Others", count: 30 },
    ];
  }

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
    <div className="min-h-screen flex bg-gradient-to-br from-white to-sprada1/50">
      {/* Sidebar */}
      <div className="hidden md:block w-72">
        <Sidebar user={JSON.parse(localStorage.getItem("user") || "{}")} />
      </div>

      {/* Topbar */}
      <div ref={topbarRef} className="app-topbar fixed top-0 left-0 right-0 z-50">
        <Topbar />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <main className="p-6 pt-[var(--app-header-height,72px)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-sprada2">Dashboard</h3>
              <p className="text-sm text-sprada2/70">
                Business metrics & live activities
              </p>
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
                {events.length} events
              </div>
            </div>
          </div>

          {/* METRIC CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Visitors"
              value={visitors?.total_visitors ?? 0}
              delta={
                visitors?.visitors_today ? `Today ${visitors.visitors_today}` : null
              }
              icon="👁️"
            />

            <MetricCard
              title="Visitors Today"
              value={visitors?.visitors_today ?? 0}
              delta={
                visitors?.new_visitors_today
                  ? `New ${visitors.new_visitors_today}`
                  : null
              }
              icon="📈"
            />

            <MetricCard title="Products" value={products?.length ?? 0} delta={null} icon="📦" />

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
                  ? leadsStats.delta >= 0
                    ? `+${leadsStats.delta}`
                    : `${leadsStats.delta}`
                  : "+0"
              }
              icon={<Users className="w-6 h-6 text-sprada4/90" />}
            />

            <MetricCard
              title="New Leads (Today)"
              value={leadsStats?.today ?? 0}
              delta={
                typeof leadsStats?.todayDelta === "number"
                  ? leadsStats.todayDelta >= 0
                    ? `+${leadsStats.todayDelta}`
                    : `${leadsStats.todayDelta}`
                  : "+0"
              }
              icon="📨"
            />
          </div>

          {/* CHARTS LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            {/* Left: Visitors + review/product mix */}
            <div className="lg:col-span-2 space-y-4">
              <VisitorsTrend data={visitorsTrendData} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReviewsDonut distribution={reviewsDonutData} />
                <ProductsBar data={productsByCategory} />
              </div>

              {/* Additional product visualizations (full-width row) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <ProductsDonut data={productsByCategory} />
                <ProductsPie data={productsByCategory} />
                <ProductsLine data={productsLineData} />
              </div>
            </div>

            {/* Right column: lists */}
            <div className="space-y-4">
              <LatestProducts items={products || []} />
              <LatestBlogs max={5} />
              <LatestLeads max={5} />
              <PushList items={push || []} />
            </div>
          </div>

          {/* VISITOR SESSIONS + FEED */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <VisitorSessions items={visits || []} />

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-sm text-sprada3 font-medium mb-3">Activity Feed</div>

                <div className="text-sm text-sprada2/70">
                  {events.length === 0
                    ? "No live events — SSE not configured server-side."
                    : events.slice(0, 20).map((e, i) => (
                        <div key={i} className="py-2 border-t first:border-t-0">
                          <div className="text-xs text-sprada2/80">
                            {e.type || e.event || "event"} •{" "}
                            {new Date(e.ts || Date.now()).toLocaleTimeString()}
                          </div>
                          <div className="text-sm text-sprada2">
                            {e.msg || JSON.stringify(e.payload || e)}
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

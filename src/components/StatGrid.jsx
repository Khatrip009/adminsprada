// src/components/StatGrid.jsx
import React from "react";
import MetricCard from "./MetricCard";
import { FiUsers, FiFileText, FiPackage, FiStar } from "react-icons/fi";

export default function StatGrid({ visitors, reviewsStats, products, blogs }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      <MetricCard
        title="Total Visitors"
        value={visitors?.total_visitors || 0}
        delta="+live"
        icon={<FiUsers />}
      />

      <MetricCard
        title="Products"
        value={products?.length || 0}
        delta="+active"
        icon={<FiPackage />}
      />

      <MetricCard
        title="Blogs"
        value={blogs?.length || 0}
        delta="+published"
        icon={<FiFileText />}
      />

      <MetricCard
        title="Avg Rating"
        value={reviewsStats?.avg_rating || "0.0"}
        delta={reviewsStats?.total ? `${reviewsStats.total} reviews` : "+0"}
        icon={<FiStar />}
      />

    </div>
  );
}

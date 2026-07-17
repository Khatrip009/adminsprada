// src/hooks/useDashboardData.js
import { useEffect, useState } from "react";
import {
  getVisitorSummary,
  getReviewsStats,
  getRecentReviews,
  getCategories,
  getRecentProducts,
  getRecentBlogs,
  getPushSubscriptions,
  getVisitorSessions
} from "../lib/api";

export default function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    visitors: null,
    reviewsStats: null,
    reviews: [],
    categories: [],
    products: [],
    blogs: [],
    push: [],
    visits: [], // renamed from 'visits' to match expected prop in VisitorSessions
  });

  useEffect(() => {
    (async () => {
      try {
        const [
          visitors,
          reviewsStats,
          reviews,
          categories,
          products,
          blogs,
          pushList,
          visits
        ] = await Promise.allSettled([
          getVisitorSummary(),
          getReviewsStats(),
          getRecentReviews(),
          getCategories(),
          getRecentProducts(12),
          getRecentBlogs(8),
          getPushSubscriptions(),
          getVisitorSessions()
        ]);

        setData({
          // ✅ getVisitorSummary returns { total, today }
          visitors: visitors.status === 'fulfilled' ? visitors.value : null,
          // ✅ getReviewsStats returns { total, average }
          reviewsStats: reviewsStats.status === 'fulfilled' ? reviewsStats.value : null,
          // ✅ getRecentReviews returns an array of reviews
          reviews: (reviews.status === 'fulfilled' && Array.isArray(reviews.value)) ? reviews.value : [],
          // ✅ getCategories returns an array
          categories: (categories.status === 'fulfilled' && Array.isArray(categories.value)) ? categories.value : [],
          // ✅ getRecentProducts returns an array of products
          products: (products.status === 'fulfilled' && Array.isArray(products.value)) ? products.value : [],
          // ✅ getRecentBlogs returns an array of blogs
          blogs: (blogs.status === 'fulfilled' && Array.isArray(blogs.value)) ? blogs.value : [],
          // ✅ getPushSubscriptions returns an array
          push: (pushList.status === 'fulfilled' && Array.isArray(pushList.value)) ? pushList.value : [],
          // ✅ getVisitorSessions returns an array of sessions/visitors
          visits: (visits.status === 'fulfilled' && Array.isArray(visits.value)) ? visits.value : [],
        });
      } catch (err) {
        console.error("dashboard load error", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, ...data };
}
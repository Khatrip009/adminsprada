import { useEffect, useState } from "react";
import { getVisitorSummary, getReviewsStats, getRecentReviews, getCategories, getRecentProducts, getRecentBlogs, getPushSubscriptions, getVisitorSessions } from "../lib/api";

export default function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    visitors: null, reviewsStats: null, reviews: [], categories: [], products: [], blogs: [], home: null, visits: [], push: []
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
          visitors: visitors.status === 'fulfilled' ? visitors.value : null,
          reviewsStats: reviewsStats.status === 'fulfilled' ? reviewsStats.value : null,
          reviews: reviews.status === 'fulfilled' ? (reviews.value.reviews || []) : [],
          categories: categories.status === 'fulfilled' ? categories.value : [],
          products: products.status === 'fulfilled' ? (products.value.products || []) : [],
          blogs: blogs.status === 'fulfilled' ? (blogs.value.blogs || []) : [],
          push: pushList.status === 'fulfilled' ? (pushList.value.subscriptions || []) : [],
          visits: visits.status === 'fulfilled' ? (visits.value.subscriptions || []) : [],
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

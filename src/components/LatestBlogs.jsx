// src/components/LatestBlogs.jsx
import React, { useEffect, useState } from "react";

/**
 * Robust LatestBlogs.jsx
 * - Attempts API_BASE from import.meta.env.VITE_API_BASE (if set)
 * - If response content-type is not JSON, logs server HTML and tries fallback to relative /api (once)
 * - Shows latest `max` blogs but clamps to 5 (client enforces latest 5)
 * - likes_count from list, comments_count fallback fetch
 * - Stable image loading with local fallback
 */

const API_BASE = (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE)
  ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, "")
  : "";

function niceDate(d) {
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString();
  } catch {
    return "";
  }
}

function BlogCard({ blog, fallbackSrc, apiBaseForComments }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(blog.image || fallbackSrc);
  const [commentsCount, setCommentsCount] = useState(
    blog.comments_count != null ? blog.comments_count : null
  );

  useEffect(() => {
    setImgSrc(blog.image || fallbackSrc);
    setImgLoaded(false);
  }, [blog.image, fallbackSrc]);

  useEffect(() => {
    // fetch comments count only if not present
    if (commentsCount == null) {
      (async () => {
        try {
          // prefer numeric id; if your list uses slug, adjust accordingly
          const idOrSlug = encodeURIComponent(blog.id || blog.slug);
          const url = `${apiBaseForComments || ""}/api/blogs/${idOrSlug}/comments`;
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) return setCommentsCount(0);
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("application/json")) {
            // backend returned HTML — treat as 0 but log for debugging
            const text = await res.text();
            console.warn("[LatestBlogs] comments endpoint returned non-json:", url, text);
            setCommentsCount(0);
            return;
          }
          const json = await res.json();
          if (json && Array.isArray(json.comments)) setCommentsCount(json.comments.length);
          else setCommentsCount(0);
        } catch (e) {
          console.error("[LatestBlogs] comments fetch err", e);
          setCommentsCount(0);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once per card

  return (
    <a href={`/blog/${encodeURIComponent(blog.slug)}`} className="block group" aria-label={blog.title}>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
        <div className="relative w-full pt-[56%] bg-gray-100">
          <img
            src={imgSrc}
            alt={blog.title || "blog image"}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              e.target.onerror = null;
              if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
              else setImgLoaded(true);
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            fetchPriority="low"
          />
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse w-3/4 h-8 bg-gray-200 rounded" />
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-sprada2 line-clamp-2">{blog.title}</h3>
              {blog.excerpt ? <p className="text-xs text-sprada2/70 mt-1 line-clamp-2">{blog.excerpt}</p> : null}
            </div>
            <div className="text-right text-xs text-sprada2/60">
              <div>{niceDate(blog.published_at || blog.created_at)}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-sprada2/70">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s-7-4.35-9-7c-1.5-1.9-1-5 2-6 2-1 4-1 6-1s4 0 6 1c3 1 3.5 4.1 2 6-2 2.65-9 7-9 7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{blog.likes_count != null ? blog.likes_count : "—"}</span>
              </span>

              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{commentsCount != null ? commentsCount : "—"}</span>
              </span>
            </div>

            <div className="text-right">
              {Array.isArray(blog.categories) && blog.categories.length > 0 ? (
                <div className="text-xs">
                  <span className="px-2 py-0.5 bg-sprada3/10 text-sprada3 rounded-full">{blog.categories[0].name}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function LatestBlogs({ max = 5 }) {
  // clamp to maximum of 5 regardless of prop passed
  const maxToShow = Math.min(5, Math.max(1, Number(max || 5))); // ensure between 1 and 5
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fallbackSrc = "/images/blog-fallback.png";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    // start with API_BASE if provided, but we will fallback to relative /api once if content-type invalid
    const baseCandidates = [];
    if (API_BASE) baseCandidates.push(API_BASE);
    baseCandidates.push(""); // relative fallback

    (async () => {
      let lastErr = null;
      for (let i = 0; i < baseCandidates.length && mounted; i++) {
        const base = baseCandidates[i];
        // use maxToShow for fetch limit to ensure server-side limit matches client
        const url = `${base}/api/blogs?limit=${maxToShow}`.replace(/\/\/api/, '/api'); // ensures no double //
        try {
          const res = await fetch(url, { credentials: "include" });
          const contentType = (res.headers.get("content-type") || "").toLowerCase();

          if (!res.ok) {
            // capture server-response body for debugging if not json
            let detail = `${res.status} ${res.statusText}`;
            if (contentType.includes("application/json")) {
              const j = await res.json();
              detail = j && (j.error || j.message) ? (j.error || j.message) : detail;
            } else {
              const text = await res.text();
              console.warn("[LatestBlogs] non-json error page", url, text);
              detail = `unexpected_content_type(${res.status})`;
            }
            throw new Error(detail);
          }

          if (!contentType.includes("application/json")) {
            // log HTML returned so user can diagnose (shows 404/index.html)
            const text = await res.text();
            console.warn("[LatestBlogs] expected JSON but got:", url, text);
            throw new Error("unexpected_content_type");
          }

          const json = await res.json();
          // support both { blogs: [...] } and direct array responses
          const arr = Array.isArray(json) ? json : (Array.isArray(json.blogs) ? json.blogs : null);
          if (!arr) throw new Error("invalid_json_structure");

          // Ensure newest first client-side: sort by published_at (fallback created_at)
          const sorted = arr.slice().sort((a, b) => {
            const da = new Date(b.published_at || b.created_at).getTime() || 0;
            const db = new Date(a.published_at || a.created_at).getTime() || 0;
            return da - db;
          });

          if (mounted) {
            setBlogs(sorted.slice(0, maxToShow));
            setLoading(false);
            setError("");
          }
          return; // success, exit candidate loop
        } catch (err) {
          lastErr = err;
          console.warn("[LatestBlogs] load attempt failed for base:", base, err && err.message ? err.message : err);
          // try next base candidate
        }
      }

      if (mounted) {
        setLoading(false);
        setError(lastErr && lastErr.message ? lastErr.message : "failed");
      }
    })();

    return () => { mounted = false; };
  }, [maxToShow]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-sprada3">Latest Blogs</div>
          <div className="text-lg font-bold text-sprada2">Recent posts</div>
        </div>
        <div>
          <a href="/blogs" className="text-xs text-sprada3 hover:underline">View all</a>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-3 animate-pulse h-40" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">Failed to load blogs: {error}</div>
      ) : blogs.length === 0 ? (
        <div className="text-sm text-sprada2/60">No recent blogs</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {blogs.map((b) => (
            <BlogCard key={b.id || b.slug} blog={b} fallbackSrc={fallbackSrc} apiBaseForComments={API_BASE || ""} />
          ))}
        </div>
      )}
    </div>
  );
}

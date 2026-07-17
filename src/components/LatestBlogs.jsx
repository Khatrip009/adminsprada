// src/components/LatestBlogs.jsx
import React, { useEffect, useState } from "react";
import { getBlogs, getComments, getLikesCount } from "../lib/api";

/**
 * LatestBlogs – displays recent blog posts with comments & likes counts.
 * Uses Supabase via the new api.js functions.
 */
function niceDate(d) {
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString();
  } catch {
    return "";
  }
}

function BlogCard({ blog, fallbackSrc }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(blog.og_image || blog.image || fallbackSrc);
  const [commentsCount, setCommentsCount] = useState(null);
  const [likesCount, setLikesCount] = useState(null);

  // Fetch counts for this blog
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Get comments (published only, unless you want all)
        const comments = await getComments(blog.id, { all: false });
        setCommentsCount(comments?.length || 0);
      } catch (err) {
        console.warn(`Failed to fetch comments for blog ${blog.id}`, err);
        setCommentsCount(0);
      }

      try {
        const likes = await getLikesCount(blog.id);
        setLikesCount(likes?.count || 0);
      } catch (err) {
        console.warn(`Failed to fetch likes for blog ${blog.id}`, err);
        setLikesCount(0);
      }
    };

    fetchCounts();
  }, [blog.id]);

  useEffect(() => {
    setImgSrc(blog.og_image || blog.image || fallbackSrc);
    setImgLoaded(false);
  }, [blog.og_image, blog.image, fallbackSrc]);

  return (
    <a href={`/blog/${encodeURIComponent(blog.slug || blog.id)}`} className="block group" aria-label={blog.title}>
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
                <span>{likesCount !== null ? likesCount : "—"}</span>
              </span>

              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{commentsCount !== null ? commentsCount : "—"}</span>
              </span>
            </div>

            {/* Categories are not directly available; you could fetch them separately if needed */}
            {blog.categories && blog.categories.length > 0 && (
              <div className="text-right">
                <span className="px-2 py-0.5 bg-sprada3/10 text-sprada3 rounded-full">
                  {blog.categories[0].name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export default function LatestBlogs({ max = 5 }) {
  const maxToShow = Math.min(5, Math.max(1, Number(max || 5)));
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fallbackSrc = "/images/blog-fallback.png";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const data = await getBlogs(maxToShow); // fetches latest `maxToShow` blogs
        if (!mounted) return;
        // getBlogs returns an array sorted by created_at desc already
        setBlogs(data);
        setLoading(false);
        setError("");
      } catch (err) {
        console.error("[LatestBlogs] fetch error", err);
        if (mounted) {
          setError(err.message || "Failed to load blogs");
          setLoading(false);
        }
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
          {Array.from({ length: Math.min(5, maxToShow) }).map((_, i) => (
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
            <BlogCard key={b.id} blog={b} fallbackSrc={fallbackSrc} />
          ))}
        </div>
      )}
    </div>
  );
}
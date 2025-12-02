// src/pages/BlogPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import DOMPurify from "dompurify";
import dayjs from "dayjs";
import { apiGet } from "../lib/api";

/**
 * BlogPage
 * - Route: /blog/:slug
 * - Detects ?preview=true and will attempt to fetch unpublished post (requires auth token)
 *
 * Expected `blog` shapes handled (robust):
 * - { blog: { ... } }
 * - { data: { blog: { ... } } }
 * - { id, title, content, ... }
 *
 * The content should be JSON with either:
 * - content.blocks -> block-based rendering (preferred)
 * - content.html -> sanitized HTML fallback
 * - content.markdown -> markdown fallback (rendered to HTML on server or client)
 */

function safeExtractBlog(res) {
  if (!res) return null;
  if (res.blog) return res.blog;
  if (res.data && res.data.blog) return res.data.blog;
  if (res.data && res.data.content) return res.data;
  if (res.id && (res.title || res.content)) return res;
  // sometimes api returns { ok: true, blog: {...} }
  if (res.ok && res.blog) return res.blog;
  return null;
}

function slugify(text = "") {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function renderInlineText(text = "") {
  if (!text) return null;
  // Very small inline processor: turns [text](url) into anchor, else raw
  const parts = [];
  let lastIndex = 0;
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <a key={`a-${i++}`} href={m[2]} target={m[2].startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" className="text-blue-600 underline">
        {m[1]}
      </a>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function BlockRenderer({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(Math.max(block.level || 2, 1), 4)}`;
      const id = block.id || slugify(block.text || "");
      return <Tag id={id} className={`font-semibold ${block.level === 1 ? "text-3xl" : block.level === 2 ? "text-2xl" : "text-xl"} mt-6 mb-3`}>{block.text}</Tag>;
    }
    case "paragraph":
      return <p className="text-gray-700 leading-relaxed my-3">{renderInlineText(block.text)}</p>;
    case "image":
      return (
        <figure key={block.url} className="my-6">
          <img loading="lazy" src={block.url} alt={block.alt || ""} className="w-full rounded-md shadow-sm object-cover" />
          {block.caption && <figcaption className="text-sm text-gray-500 mt-2">{block.caption}</figcaption>}
        </figure>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-slate-200 pl-4 italic text-gray-800 my-4">
          <div>{block.text}</div>
          {block.author && <footer className="mt-2 text-sm text-gray-600">— {block.author}</footer>}
        </blockquote>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-decimal list-inside my-3 space-y-1">{(block.items || []).map((it, i) => <li key={i}>{renderInlineText(it)}</li>)}</ol>
      ) : (
        <ul className="list-disc list-inside my-3 space-y-1">{(block.items || []).map((it, i) => <li key={i}>{renderInlineText(it)}</li>)}</ul>
      );
    case "code":
      return (
        <pre className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto my-4"><code>{block.code}</code></pre>
      );
    case "gallery":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
          {(block.items || []).map((it, idx) => (
            <figure key={idx} className="rounded overflow-hidden">
              <img loading="lazy" src={it.url} alt={it.alt || ""} className="w-full h-48 object-cover" />
              {it.caption && <figcaption className="text-sm text-gray-500 mt-2 p-1">{it.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    case "embed":
      return (
        <div className="my-6 aspect-video rounded overflow-hidden">
          <iframe title={block.provider || "embed"} src={block.src} frameBorder="0" allowFullScreen className="w-full h-full"></iframe>
        </div>
      );
    case "cta":
      return (
        <div className="my-6">
          <a href={block.url} className={`inline-block px-5 py-3 rounded ${block.variant === "primary" ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-800"}`}>{block.text}</a>
        </div>
      );
    case "separator":
      return <hr className="my-8 border-gray-200" />;
    default:
      return <div className="text-sm text-gray-500 my-2">[Unsupported block: {block.type}]</div>;
  }
}

export default function BlogPage() {
  const { slug } = useParams(); // can be slug or id per your API
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isPreview = qs.get("preview") === "true";

  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      try {
        // 1) Try regular fetch (public)
        const basePath = `/blogs/${encodeURIComponent(slug)}`;
        // append preview flag for backend if requested (backends that support it will honor it)
        const path = isPreview ? `${basePath}?preview=true` : basePath;
        const res = await apiGet(path);
        const b = safeExtractBlog(res);
        if (b) {
          if (!mounted) return;
          setBlog(b);
          setLoading(false);
          return;
        }

        // 2) Some APIs may return different shape or require other fallbacks:
        // try /blogs/slug/:slug
        try {
          const r2 = await apiGet(`/blogs/slug/${encodeURIComponent(slug)}${isPreview ? "?preview=true" : ""}`);
          const b2 = safeExtractBlog(r2);
          if (b2) {
            if (!mounted) return;
            setBlog(b2);
            setLoading(false);
            return;
          }
        } catch (_) { /* ignore */ }

        // 3) final attempt: list endpoint with filter
        try {
          const r3 = await apiGet(`/blogs?slug=${encodeURIComponent(slug)}&limit=1`);
          const candidate = (r3 && (r3.blogs && r3.blogs[0]) ) || null;
          if (candidate) {
            if (!mounted) return;
            setBlog(candidate);
            setLoading(false);
            return;
          }
        } catch (_) { /* ignore */ }

        if (!mounted) return;
        setErrorMsg("Not found");
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Blog fetch error", err);
        // If preview was requested and we got 401, show helpful message
        if (isPreview && err?.status === 401) {
          setErrorMsg("Preview not available — please sign in to view unpublished posts.");
        } else if (err?.status === 404) {
          setErrorMsg("Post not found");
        } else {
          setErrorMsg("Failed to load post");
        }
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [slug, isPreview]);

  const content = blog?.content || {};
  const lead = content.lead || {};
  const hero = lead.hero_image || {};
  const author = lead.author || blog?.author || {};
  const publishedAt = lead.published_at || blog?.published_at || blog?.created_at;

  const readingTime = content.meta?.reading_time_min || Math.max(1, Math.round((JSON.stringify(content || "").length / 800)));

  // Build TOC from blocks
  const toc = useMemo(() => {
    const items = [];
    const blocks = content.blocks || [];
    for (const b of blocks) {
      if (b.type === "heading" && (b.level === 2 || b.level === 3)) {
        items.push({ id: b.id || slugify(b.text || ""), level: b.level, text: b.text });
      }
    }
    return items;
  }, [content]);

  // JSON-LD
  const jsonLd = useMemo(() => {
    if (!blog) return null;
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": blog.title || "",
      "image": blog.og_image || hero.url || [],
      "author": {
        "@type": "Person",
        "name": author.name || ""
      },
      "datePublished": publishedAt,
      "dateModified": blog.updated_at || publishedAt,
      "description": blog.excerpt || "",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": blog.canonical_url || window.location.href
      }
    };
  }, [blog, author, hero, publishedAt]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded w-full" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center text-slate-600">
          <h2 className="text-2xl font-semibold mb-2">{errorMsg}</h2>
          {isPreview && <div className="text-sm text-slate-500">If this is a preview, sign in to view unpublished content.</div>}
        </div>
      </main>
    );
  }

  // Render the article
  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {/* Preview banner */}
      {isPreview && (
        <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-yellow-800">
          <strong>Preview mode:</strong> You are viewing an unpublished draft. Changes may not be public.
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 sprada-heading">{blog.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
              {author.avatar && <img src={author.avatar} alt={author.name || ""} className="w-9 h-9 rounded-full object-cover" />}
              <div>
                <div className="font-medium text-gray-900">{author.name}</div>
                <div className="text-xs text-gray-500">{publishedAt ? dayjs(publishedAt).format("MMMM D, YYYY") : "Draft"} · {readingTime} min read</div>
              </div>
              {/* Draft badge when not published */}
              {!blog.is_published && !blog.published_at && (
                <div className="ml-4 px-2 py-1 rounded bg-gray-800 text-white text-xs">Draft</div>
              )}
            </div>
          </div>
        </div>

        {hero?.url && (
          <div className="mt-6 rounded-md overflow-hidden shadow-sm">
            <img loading="lazy" src={hero.url} alt={hero.alt || blog.title || ""} className="w-full h-64 sm:h-96 object-cover" />
            {hero.caption && <div className="text-sm text-gray-500 px-2 py-3">{hero.caption}</div>}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 prose prose-lg">
          {/* Block-based rendering */}
          {content.blocks && Array.isArray(content.blocks) && content.blocks.length > 0 ? (
            content.blocks.map((blk, idx) => <BlockRenderer key={idx} block={blk} />)
          ) : (
            // Fall back to content.html or markdown (if markdown present the server ideally returns html)
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  (content.html && String(content.html)) ||
                  (content.markdown && String(content.markdown)) ||
                  (blog.content && blog.content.html) ||
                  ""
                )
              }}
            />
          )}

          {/* Footer: author block and social */}
          <footer className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-4">
              {author.avatar && <img src={author.avatar} alt={author.name || ""} className="w-12 h-12 rounded-full object-cover" />}
              <div>
                <div className="font-semibold">{author.name}</div>
                {author.bio && <div className="text-sm text-gray-600">{author.bio}</div>}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <a target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(blog.canonical_url || window.location.href)}&title=${encodeURIComponent(blog.title || "")}`} className="text-sm px-3 py-2 border rounded">Share</a>
              <a target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(blog.canonical_url || window.location.href)}&text=${encodeURIComponent(blog.title || "")}`} className="text-sm px-3 py-2 border rounded">Tweet</a>
            </div>
          </footer>
        </div>

        {/* Sidebar: TOC + metadata */}
        <aside className="lg:col-span-4 sticky top-24 space-y-6">
          <div className="p-4 border rounded bg-white shadow-sm">
            <div className="text-sm text-gray-600">Published</div>
            <div className="text-sm font-semibold">{publishedAt ? dayjs(publishedAt).format("MMMM D, YYYY") : "Not published"}</div>
            {blog.excerpt && <div className="text-xs text-gray-500 mt-2">{blog.excerpt}</div>}
          </div>

          {toc && toc.length > 0 && (
            <div className="p-4 border rounded bg-white shadow-sm">
              <div className="text-sm font-semibold mb-2">On this page</div>
              <nav className="text-sm text-gray-700 space-y-1">
                {toc.map((t, i) => (
                  <a key={i} href={`#${t.id}`} className={`block ${t.level === 2 ? 'font-medium' : 'pl-4 text-sm text-gray-600'}`}>{t.text}</a>
                ))}
              </nav>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

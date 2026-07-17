// src/pages/BlogPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import DOMPurify from "dompurify";
import dayjs from "dayjs";
import { supabase, toAbsoluteImageUrl } from "../lib/api";
import auth from "../lib/auth";

/* ------------------------------
   Helpers
-------------------------------- */
function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function renderInlineText(text = "") {
  if (!text) return null;
  const parts = [];
  let lastIndex = 0;
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <a
        key={`a-${i++}`}
        href={m[2]}
        target={m[2].startsWith("http") ? "_blank" : "_self"}
        rel="noopener noreferrer"
        className="text-sky-600 hover:underline"
      >
        {m[1]}
      </a>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/* BlockRenderer with robust URL conversion */
function BlockRenderer({ block }) {
  if (!block) return null;

  // Helper: ensure we always get an absolute URL (or null)
  const getImageSrc = (url) => {
    if (!url) return null;
    const abs = toAbsoluteImageUrl(url);
    return abs || null; // if conversion fails, return null (don't use relative)
  };

  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(Math.max(block.level || 2, 1), 4)}`;
      const id = block.id || slugify(block.text || "");
      return (
        <Tag id={id} className={`font-semibold ${block.level === 1 ? "text-3xl" : block.level === 2 ? "text-2xl" : "text-xl"} mt-6 mb-3`}>
          {block.text}
        </Tag>
      );
    }
    case "paragraph":
      return <p className="text-gray-700 leading-relaxed my-3">{renderInlineText(block.text)}</p>;
    case "image":
      return (
        <figure className="my-6">
          <img
            loading="lazy"
            src={getImageSrc(block.url)}
            alt={block.alt || ""}
            className="w-full rounded-md shadow-sm object-cover max-h-[60vh]"
            style={{ width: "100%", height: "auto" }}
          />
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
        <ol className="list-decimal list-inside my-3 space-y-1">
          {(block.items || []).map((it, i) => <li key={i}>{renderInlineText(it)}</li>)}
        </ol>
      ) : (
        <ul className="list-disc list-inside my-3 space-y-1">
          {(block.items || []).map((it, i) => <li key={i}>{renderInlineText(it)}</li>)}
        </ul>
      );
    case "code":
      return <pre className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto my-4"><code>{block.code}</code></pre>;
    case "gallery":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
          {(block.items || []).map((it, idx) => (
            <figure key={idx} className="rounded overflow-hidden">
              <img loading="lazy" src={getImageSrc(it.url)} alt={it.alt || ""} className="w-full h-48 object-cover" />
              {it.caption && <figcaption className="text-sm text-gray-500 mt-2 p-1">{it.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    case "embed":
      return (
        <div className="my-6 aspect-video rounded overflow-hidden">
          <iframe title={block.provider || "embed"} src={block.src} frameBorder="0" allowFullScreen className="w-full h-full" />
        </div>
      );
    case "cta":
      return (
        <div className="my-6">
          <a href={block.url} className={`inline-block px-5 py-3 rounded ${block.variant === "primary" ? "bg-sky-700 text-white" : "bg-gray-100 text-gray-800"}`}>
            {block.text}
          </a>
        </div>
      );
    case "separator":
      return <hr className="my-8 border-gray-200" />;
    default:
      return <div className="text-sm text-gray-500 my-2">[Unsupported block: {block.type}]</div>;
  }
}

/* ------------------------------
        MAIN PAGE
-------------------------------- */
export default function BlogPage() {
  const { slug } = useParams();
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isPreview = qs.get("preview") === "true";

  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await auth.getUser();
        setIsLoggedIn(!!user);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  /* Fetch blog from Supabase with blog_images */
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      try {
        let query = supabase
          .from("blogs")
          .select(`
            *,
            blog_images ( id, url, caption, created_at )
          `)
          .eq("slug", slug);

        if (!isPreview || !isLoggedIn) {
          query = query.eq("is_published", true);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          if (error.code !== "PGRST116") throw error;
          // Fallback: try by ID if slug is a UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(slug)) {
            const { data: dataById, error: errorById } = await supabase
              .from("blogs")
              .select(`
                *,
                blog_images ( id, url, caption, created_at )
              `)
              .eq("id", slug)
              .maybeSingle();
            if (!errorById && dataById) {
              setBlog(normalizeBlog(dataById));
              setLoading(false);
              return;
            }
          }
          setErrorMsg("Not found");
        } else if (data) {
          setBlog(normalizeBlog(data));
        } else {
          setErrorMsg("Not found");
        }
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Blog fetch error:", err);
        setErrorMsg(isPreview && err?.status === 401 ? "Preview not available — please sign in to view unpublished posts." : "Failed to load post");
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [slug, isPreview, isLoggedIn]);

  /* Normalize blog: ensure all image URLs are absolute */
  function normalizeBlog(raw) {
    if (!raw) return null;
    const b = { ...raw };

    // Compute primary_image from og_image or first blog_images entry
    const firstImage = b.blog_images?.[0]?.url || null;
    const rawPrimary = b.og_image || firstImage;
    // Convert to absolute URL – if conversion fails, use null
    b.primary_image = rawPrimary ? toAbsoluteImageUrl(rawPrimary) : null;

    // Convert all other image fields
    if (b.og_image) b.og_image = toAbsoluteImageUrl(b.og_image);
    if (b.author?.avatar) b.author.avatar = toAbsoluteImageUrl(b.author.avatar);
    if (b.content?.lead?.hero_image?.url) {
      b.content.lead.hero_image.url = toAbsoluteImageUrl(b.content.lead.hero_image.url);
    }

    // Ensure hero.url is absolute (if it exists in the lead object)
    if (b.content?.lead?.hero_image?.url) {
      b.content.lead.hero_image.url = toAbsoluteImageUrl(b.content.lead.hero_image.url);
    }

    return b;
  }

  /* Loading + Error UI */
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

  /* Content preparation */
  const content = blog?.content || {};
  const lead = content.lead || {};
  const hero = lead.hero_image || {};
  const author = lead.author || blog?.author || {};
  const publishedAt = lead.published_at || blog?.published_at || blog?.created_at;
  const readingTime = content.meta?.reading_time_min || Math.max(1, Math.round(JSON.stringify(content || "").length / 800));

  /* Build TOC */
  const toc = useMemo(() => {
    const items = [];
    const blocks = content.blocks || [];
    for (const b of blocks) {
      if (b.type === "heading" && (b.level === 2 || b.level === 3)) {
        items.push({
          id: b.id || slugify(b.text || ""),
          level: b.level,
          text: b.text,
        });
      }
    }
    return items;
  }, [content]);

  /* Scroll to hash */
  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.replace("#", ""));
    const el = document.getElementById(id);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [location.hash, blog]);

  /* JSON-LD Schema */
  const jsonLd = useMemo(() => {
    if (!blog) return null;
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: blog.title || "",
      image: blog.og_image ? [toAbsoluteImageUrl(blog.og_image)] : [],
      author: { "@type": "Person", name: author.name || "" },
      datePublished: publishedAt,
      dateModified: blog.updated_at || publishedAt,
      description: blog.excerpt || "",
      mainEntityOfPage: { "@type": "WebPage", "@id": blog.canonical_url || window.location.href },
    };
  }, [blog, author, publishedAt]);

  const [tocOpen, setTocOpen] = useState(false);

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      {isPreview && (
        <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-yellow-800">
          <strong>Preview mode:</strong> You are viewing an unpublished draft.
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 sprada-heading">{blog.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {author.avatar && (
                <img src={toAbsoluteImageUrl(author.avatar)} alt={author.name || ""} className="w-9 h-9 rounded-full object-cover" />
              )}
              <div>
                <div className="font-medium text-gray-900">{author.name}</div>
                <div className="text-xs text-gray-500">
                  {publishedAt ? dayjs(publishedAt).format("MMMM D, YYYY") : "Draft"} · {readingTime} min read
                </div>
              </div>
              {!blog.is_published && <div className="mt-2 sm:mt-0 ml-auto sm:ml-0 px-2 py-1 rounded bg-gray-800 text-white text-xs">Draft</div>}
            </div>
          </div>
        </div>

        {/* Hero image: use primary_image (which is already absolute) or fallback to hero.url converted */}
        {(blog.primary_image || hero.url) && (
          <div className="mt-6 rounded-md overflow-hidden shadow-sm">
            <img
              loading="lazy"
              src={blog.primary_image || toAbsoluteImageUrl(hero.url)}
              alt={hero.alt || blog.title || ""}
              className="w-full h-56 sm:h-72 md:h-96 object-cover"
            />
            {hero.caption && <div className="text-sm text-gray-500 px-2 py-3">{hero.caption}</div>}
          </div>
        )}
      </header>

      {/* Body layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 prose prose-lg max-w-none">
          {content.blocks && Array.isArray(content.blocks) ? (
            content.blocks.map((blk, idx) => <BlockRenderer key={idx} block={blk} />)
          ) : (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.html || content.markdown || blog.content?.html || "") }} />
          )}

          {/* Author footer */}
          <footer className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex items-start gap-4">
              {author.avatar && <img src={toAbsoluteImageUrl(author.avatar)} alt={author.name || ""} className="w-12 h-12 rounded-full object-cover" />}
              <div>
                <div className="font-semibold">{author.name}</div>
                {author.bio && <div className="text-sm text-gray-600">{author.bio}</div>}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(blog.canonical_url || window.location.href)}&title=${encodeURIComponent(blog.title || "")}`}
                    className="text-sm px-3 py-2 border rounded"
                  >
                    Share
                  </a>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(blog.canonical_url || window.location.href)}&text=${encodeURIComponent(blog.title || "")}`}
                    className="text-sm px-3 py-2 border rounded"
                  >
                    Tweet
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Sidebar / TOC */}
        <aside className="lg:col-span-4">
          <div className="block lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setTocOpen((open) => !open)}
              aria-expanded={tocOpen}
              className="w-full text-left px-4 py-2 border rounded bg-white"
            >
              {tocOpen ? "Hide contents" : "On this page"} {tocOpen ? "▲" : "▼"}
            </button>
            {tocOpen && toc.length > 0 && (
              <nav className="mt-2 p-3 border rounded bg-white space-y-1 text-sm">
                {toc.map((t, i) => (
                  <a key={i} href={`#${t.id}`} className={`block ${t.level === 2 ? "font-medium" : "pl-4 text-gray-600 text-sm"}`}>
                    {t.text}
                  </a>
                ))}
              </nav>
            )}
          </div>

          <div className="hidden lg:block space-y-6 sticky top-24">
            <div className="p-4 border rounded bg-white shadow-sm">
              <div className="text-sm text-gray-600">Published</div>
              <div className="text-sm font-semibold">{publishedAt ? dayjs(publishedAt).format("MMMM D, YYYY") : "Not published"}</div>
              {blog.excerpt && <div className="text-xs text-gray-500 mt-2">{blog.excerpt}</div>}
            </div>

            {toc.length > 0 && (
              <div className="p-4 border rounded bg-white shadow-sm">
                <div className="text-sm font-semibold mb-2">On this page</div>
                <nav className="text-sm text-gray-700 space-y-1">
                  {toc.map((t, i) => (
                    <a key={i} href={`#${t.id}`} className={`block ${t.level === 2 ? "font-medium" : "pl-4 text-gray-600 text-sm"}`}>
                      {t.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
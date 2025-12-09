// src/pages/Blogs.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LOGO from "../assets/SPRADA_LOGO.png";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

import toast, { Toaster } from "react-hot-toast";
import TurndownService from "turndown";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import DOMPurify from "dompurify";
import dayjs from "dayjs";

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  uploadFile,
  toAbsoluteImageUrl,
  API_ORIGIN
} from "../lib/api";

/* ---------------------------
   Utility & helper functions
   --------------------------- */

function createExtensionInstanceSafely(extOrModule) {
  if (!extOrModule) return null;
  if (typeof extOrModule === "object" && extOrModule !== null && (extOrModule.name || extOrModule.extend)) {
    return extOrModule;
  }
  if (typeof extOrModule === "function") {
    try { return extOrModule(); } catch (e) {
      try { if (extOrModule.default && typeof extOrModule.default === "function") return extOrModule.default(); } catch {}
    }
  }
  if (extOrModule && typeof extOrModule === "object" && extOrModule.default) {
    return createExtensionInstanceSafely(extOrModule.default);
  }
  return extOrModule;
}
function configureExtensionSafely(extModule, config = {}) {
  try {
    if (!extModule) return null;
    if (extModule.configure && typeof extModule.configure === "function") return extModule.configure(config);
    if (extModule.default && extModule.default.configure && typeof extModule.default.configure === "function") return extModule.default.configure(config);
    if (typeof extModule === "function") {
      try { return extModule(config); } catch {}
    }
    return createExtensionInstanceSafely(extModule);
  } catch (e) {
    return createExtensionInstanceSafely(extModule);
  }
}
function dedupeExtensionsByName(instances) {
  const seen = new Set();
  const out = [];
  for (const inst of instances) {
    if (!inst) continue;
    const name = inst.name || (inst.constructor && inst.constructor.name) || null;
    if (name && seen.has(name)) continue;
    if (name) seen.add(name);
    out.push(inst);
  }
  return out;
}

/* Normalize dev absolute backend upload URLs -> relative for dev proxy */
function normalizeUploadUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && (u.port === "4200" || u.port === "")) {
      return u.pathname + u.search + u.hash;
    }
    if (u.origin === window.location.origin) return u.href;
    return url;
  } catch (e) {
    return url;
  }
}

/* Defensive image helpers to avoid local filesystem leaks and produce absolute URLs */
function isLocalFilesystemPath(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith("/mnt/")) return true;
  if (v.startsWith("c:\\") || v.startsWith("d:\\")) return true;
  if (v.startsWith("file://")) return true;
  if (v.includes("\\users\\")) return true;
  return false;
}
function safeAbsoluteImageUrl(raw, space = "blogs") {
  if (!raw || typeof raw !== "string") return null;
  const val = raw.trim();
  if (!val) return null;
  if (/^data:/i.test(val)) return val;
  if (/^https?:\/\//i.test(val)) return val;
  if (isLocalFilesystemPath(val)) return null;

  try {
    const abs = toAbsoluteImageUrl ? toAbsoluteImageUrl(val) : null;
    if (abs && !/\/mnt\//i.test(abs)) return abs;
  } catch (e) { /* ignore */ }

  try {
    if (/^\/(?:src\/)?uploads\//i.test(val)) {
      return `${API_ORIGIN}${val}`;
    }
    if (/^(?:src\/)?uploads\//i.test(val)) {
      return `${API_ORIGIN}/${val.replace(/^\/+/, "")}`;
    }
    if (!val.startsWith("/")) {
      return `${API_ORIGIN}/uploads/${space}/${val.replace(/^\/+/, "")}`;
    }
    return `${API_ORIGIN}${val}`;
  } catch {
    return null;
  }
}

/* Small modal confirm */
function ConfirmModal({ open, title, message, onCancel, onConfirm, confirmLabel = "Confirm" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg p-5 w-full max-w-md shadow-lg z-[121]">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-slate-600 mt-2">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1 bg-red-600 text-white rounded">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* inject fonts + small runtime styles */
function ensureFontsAndStyles() {
  if (typeof document === "undefined") return;
  if (!document.getElementById("sprada-fonts")) {
    const l = document.createElement("link");
    l.id = "sprada-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Roboto+Slab:wght@400;600&display=swap";
    document.head.appendChild(l);
  }
  if (!document.getElementById("sprada-styles")) {
    const s = document.createElement("style");
    s.id = "sprada-styles";
    s.innerHTML = `
      .sprada-heading { font-family: "Roboto Slab", serif; }
      .sprada-ui { font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto; }
      .uploaded-thumb { width: 90px; height: 62px; object-fit: cover; border-radius: 6px; border: 1px solid #e6e6e6; }
      .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    `;
    document.head.appendChild(s);
  }
}

/* Slug generator */
function generateSlugFromTitle(title) {
  if (!title) return "";
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Inline text renderer that preserves [label](url) links */
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
      <a key={`a-${i++}`} href={m[2]} target={m[2].startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer" className="text-sky-600 hover:underline">
        {m[1]}
      </a>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/* Block renderer for previews and details */
function BlockRenderer({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(Math.max(block.level || 2, 1), 4)}`;
      const id = block.id || String(block.text || "").toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      return <Tag id={id} className={`font-semibold ${block.level === 1 ? "text-3xl" : block.level === 2 ? "text-2xl" : "text-xl"} mt-6 mb-3`}>{block.text}</Tag>;
    }
    case "paragraph":
      return <p className="text-gray-700 leading-relaxed my-3">{renderInlineText(block.text)}</p>;
    case "image":
      return (
        <figure key={block.url} className="my-6">
          <img loading="lazy" src={safeAbsoluteImageUrl(normalizeUploadUrl(block.url) || block.url)} alt={block.alt || ""} className="w-full rounded-md shadow-sm object-cover" />
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
      return <pre className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto my-4"><code>{block.code}</code></pre>;
    case "gallery":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
          {(block.items || []).map((it, idx) => (
            <figure key={idx} className="rounded overflow-hidden">
              <img loading="lazy" src={safeAbsoluteImageUrl(normalizeUploadUrl(it.url) || it.url)} alt={it.alt || ""} className="w-full h-48 object-cover" />
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

/* ===========================
   PreviewModal - inline blog preview inside dashboard
   =========================== */
function PreviewModal({ open, blogRef, onClose }) {
  const [loading, setLoading] = useState(false);
  const [blog, setBlog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setBlog(null);

    (async () => {
      try {
        if (!blogRef) throw new Error("missing blog");
        const idOrSlug = blogRef.slug || blogRef.id;
        if (!idOrSlug) throw new Error("missing id/slug");
        const path = `/blogs/${encodeURIComponent(idOrSlug)}?preview=true`;
        const res = await apiGet(path);
        const candidate = res?.blog || res?.data || res;
        if (!mounted) return;

        if (!candidate || (!candidate.content && !candidate.title)) {
          try {
            const r2 = await apiGet(`/blogs/slug/${encodeURIComponent(idOrSlug)}?preview=true`);
            const c2 = r2?.blog || r2?.data || r2;
            if (c2 && (c2.content || c2.title)) { setBlog(c2); setLoading(false); return; }
          } catch (_) {}
          setError("Preview not available");
          setLoading(false);
          return;
        }

        setBlog(candidate);
        setLoading(false);
      } catch (err) {
        console.error("Preview fetch error", err);
        if (!mounted) return;
        if (err?.status === 401) setError("Preview requires sign-in (session expired)");
        else if (err?.status === 404) setError("Post not found");
        else setError("Failed to load preview");
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [open, blogRef]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[130] flex items-start justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 z-[131] overflow-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <div>
              <h3 className="sprada-heading font-semibold text-lg">{blogRef?.title || "Preview"}</h3>
              <div className="text-sm text-slate-500">{blogRef?.excerpt || ""}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 border rounded-lg">Close</button>
            <button onClick={() => window.open(blogRef?.canonical_url || (blogRef?.slug ? `${window.location.origin}/blog/${blogRef.slug}` : null), "_blank")} className="px-3 py-2 border rounded-lg">Open on site</button>
          </div>
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-6 w-64 bg-gray-200 rounded" />
            <div className="h-48 bg-gray-200 rounded" />
            <div className="h-3 bg-gray-200 rounded" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center text-slate-600">
            <div className="text-lg font-semibold mb-2">{error}</div>
            <div className="text-sm">Make sure you're signed in with a valid admin session to preview unpublished posts.</div>
          </div>
        )}

        {!loading && blog && (
          <article className="prose max-w-none">
            <div className="mb-3 rounded-md bg-yellow-50 border border-yellow-200 p-2 text-yellow-800">
              <strong>Preview</strong> — viewing post as admin (may be unpublished).
            </div>

            <header>
              <h1 className="text-2xl sprada-heading font-bold">{blog.title}</h1>
              <div className="text-sm text-gray-600">{blog.author?.name || blog.author_name || "Author"} · {blog.published_at ? dayjs(blog.published_at).format("MMMM D, YYYY") : "Draft"}</div>
              {blog.og_image && <div className="mt-4 rounded overflow-hidden"><img loading="lazy" src={safeAbsoluteImageUrl(normalizeUploadUrl(blog.og_image) || blog.og_image)} alt={blog.title} className="w-full h-64 object-cover rounded" /></div>}
            </header>

            <section className="mt-6">
              {Array.isArray(blog.content?.blocks) && blog.content.blocks.length > 0 ? (
                blog.content.blocks.map((blk, idx) => <BlockRenderer key={idx} block={blk} />)
              ) : (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((blog.content && blog.content.html) || (blog.content && blog.content.markdown ? marked.parse(blog.content.markdown) : "") || (typeof blog.content === "string" ? blog.content : "")) }} />
              )}
            </section>

            <footer className="mt-6 border-t pt-4">
              <div className="flex items-center gap-3">
                {blog.author?.avatar && <img src={safeAbsoluteImageUrl(normalizeUploadUrl(blog.author.avatar) || blog.author.avatar)} alt={blog.author?.name || ""} className="w-12 h-12 rounded-full object-cover" />}
                <div>
                  <div className="font-semibold">{blog.author?.name || blog.author_name || ""}</div>
                  <div className="text-sm text-slate-600">{blog.author?.bio || blog.author_bio || ""}</div>
                </div>
              </div>
            </footer>
          </article>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ===========================
   BlogsPage (main exported component)
   =========================== */
export default function BlogsPage() {
  useEffect(() => ensureFontsAndStyles(), []);
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50 sprada-ui">
      {/* Sidebar for large screens */}
      <div className="hidden lg:block w-72">
        <Sidebar user={user} className="w-72" />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 overflow-auto">
            <Sidebar user={user} className="w-72" />
            <div className="mt-4">
              <button onClick={() => setSidebarOpen(false)} className="px-3 py-2 border rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="lg:hidden px-2 py-2 border rounded">
              ☰
            </button>
            <img src={LOGO} alt="Sprada" className="w-36 object-contain" />
            <div>
              <h1 className="sprada-heading text-2xl text-[#0f6b5a] font-semibold">Blog Manager</h1>
              <div className="text-sm text-slate-500">Create, edit, publish and moderate blog posts — friendly hints included.</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 hidden sm:block">Signed in as</div>
            <div className="px-3 py-2 bg-white border rounded-lg text-sm shadow-sm">{user?.name || user?.username || "Admin"}</div>
          </div>
        </header>

        <div className="bg-white rounded-2xl p-5 shadow-md">
          <BlogsAdmin />
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

/* ===========================
   BlogsAdmin - listing + actions
   =========================== */
function BlogsAdmin() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlogRef, setPreviewBlogRef] = useState(null);

  const [confirm, setConfirm] = useState({ open: false, onConfirm: null, title: "", message: "" });

  const handleUnauthorized = () => {
    toast.error("Session expired — please sign in again.");
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch (e) { /* ignore */ }
    navigate("/login", { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/blogs?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}`);
      const arr = (res && (res.blogs || res)) || [];
      const normalized = (Array.isArray(arr) ? arr : []).map(b => ({
        ...b,
        image: normalizeUploadUrl(b.image || b.og_image || b.thumbnail || "")
      }));
      setBlogs(normalized);
    } catch (e) {
      console.error(e);
      if (e?.status === 401) return handleUnauthorized();
      toast.error("Failed loading blogs");
    } finally { setLoading(false); }
  }, [page, limit, q]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    navigate("/dashboard/blogs/new");
  }
  function openEdit(b) {
    const key = b?.slug || b?.id;
    if (!key) { toast.error("Cannot edit: missing slug/id"); return; }
    navigate(`/dashboard/blogs/edit/${encodeURIComponent(key)}`);
  }

  function openDetail(b) { setSelected(b); setDetailOpen(true); }

  function openPreview(b) {
    if (!b) return;
    setPreviewBlogRef(b);
    setPreviewOpen(true);
  }

  function openView(b) {
    if (!b) return;
    let url = b.canonical_url || (b.slug ? `${window.location.origin}/blog/${b.slug}` : (b.id ? `${window.location.origin}/blog/${b.id}` : null));
    if (!url) { toast.error("Cannot open: no slug or canonical URL available"); return; }
    if (!b.published_at) {
      const u = new URL(url, window.location.origin);
      if (!u.searchParams.has("preview")) u.searchParams.set("preview", "true");
      url = u.toString();
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(blog) {
    setConfirm({
      open: true,
      title: "Delete blog",
      message: `Delete "${blog.title}"? This action is permanent.`,
      onConfirm: async () => {
        try {
          await apiDelete(`/blogs/${encodeURIComponent(blog.id)}`);
          setBlogs(prev => prev.filter(x => x.id !== blog.id));
          toast.success("Deleted");
        } catch (e) {
          console.error(e);
          if (e?.status === 401) return handleUnauthorized();
          toast.error("Delete failed");
        } finally {
          setConfirm({ open: false, onConfirm: null, title: "", message: "" });
        }
      }
    });
  }

  async function togglePublish(blog) {
    try {
      const publish = !blog.published_at;
      await apiPost(`/blogs/${encodeURIComponent(blog.id)}/publish`, { publish });
      toast.success(publish ? "Published" : "Unpublished");
      load();
    } catch (e) {
      console.error(e);
      if (e?.status === 401) return handleUnauthorized();
      toast.error("Publish action failed");
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") load(); }}
            placeholder="Search title or excerpt..."
            className="border rounded-lg px-3 py-2 w-full md:w-80"
            aria-label="Search blogs"
          />
          <button onClick={load} className="px-3 py-2 border rounded-lg">Search</button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={openNew} className="px-4 py-2 bg-[#0f6b5a] text-white rounded-lg shadow-sm">New Blog</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array.from({ length: limit }).map((_, i) => <div key={i} className="h-44 bg-gray-100 animate-pulse rounded-2xl" />) :
          (blogs.length === 0 ? <div className="text-slate-500">No blogs yet</div> :
            blogs.map(b => (
              <article key={b.id} className="bg-white border rounded-2xl p-4 hover:shadow-md transition transform hover:-translate-y-1">
                <div className="flex gap-4">
                  <div className="w-28 h-20 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    {b.image ? <img loading="lazy" src={safeAbsoluteImageUrl(normalizeUploadUrl(b.image) || b.image)} alt={b.title} className="w-full h-full object-cover" /> : <div className="text-xs text-slate-400">No image</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="sprada-heading font-medium text-slate-800 line-clamp-3">{b.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{b.excerpt}</p>
                    <div className="mt-2 text-xs text-slate-600 flex flex-wrap items-center gap-3">
                      <span>{b.published_at ? (new Date(b.published_at)).toLocaleDateString() : "Draft"}</span>
                      <span>•</span>
                      <span>{b.likes_count ?? 0} likes</span>
                      <span>•</span>
                      <span>{b.comments_count ?? 0} comments</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openEdit(b)} className="px-3 py-1 text-xs border rounded hover:bg-slate-50">Edit</button>
                    <button onClick={() => openPreview(b)} className="px-3 py-1 text-xs border rounded bg-white hover:bg-slate-50">Preview</button>
                    <button onClick={() => openView(b)} className="px-3 py-1 text-xs border rounded">Open</button>
                    <button onClick={() => openDetail(b)} className="px-3 py-1 text-xs border rounded">Details</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePublish(b)} className="px-3 py-1 text-xs border rounded">{b.published_at ? "Unpublish" : "Publish"}</button>
                    <button onClick={() => handleDelete(b)} className="px-3 py-1 text-xs border rounded text-red-600">Delete</button>
                  </div>
                </div>
              </article>
            ))
          )
        }
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-2 border rounded-lg mr-2">Prev</button>
          <button onClick={() => setPage(p => p + 1)} className="px-3 py-2 border rounded-lg">Next</button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-500">Per page:</label>
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="border rounded-lg px-3 py-2">
            {[6,12,20,50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {detailOpen && selected && <BlogDetail
        blog={selected}
        onClose={() => { setDetailOpen(false); setSelected(null); }}
        onChange={() => load() }
      />}

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onConfirm={() => confirm.onConfirm && confirm.onConfirm()}
      />

      {previewOpen && <PreviewModal open={previewOpen} blogRef={previewBlogRef} onClose={() => { setPreviewOpen(false); setPreviewBlogRef(null); }} />}
    </div>
  );
}

/* ===========================
   BlogEditor modal (used by admin) - simplified and responsive
   =========================== */
function BlogEditor({ blog, onClose, onSaved }) {
  const navigate = useNavigate();
  const td = useRef(new TurndownService()).current;
  const [form, setForm] = useState({ ...(blog || {}) });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("wysiwyg");
  const fileInputRef = useRef(null);
  const [uploadedImages, setUploadedImages] = useState([]);

  useEffect(() => {
    setForm({ ...(blog || {}) });
    (async () => {
      if (blog && blog.id) {
        try {
          let r = null;
          try { r = await apiGet(`/blog-images?blogId=${encodeURIComponent(blog.id)}`); } catch (err) { try { r = await apiGet(`/blog-images?blog_id=${encodeURIComponent(blog.id)}`); } catch (_) { r = null; } }
          const arr = (r && (r.images || r)) || [];
          const mapped = arr.map(it => ({ id: it.id, url: normalizeUploadUrl(it.url || it.public_url || it.path || it.address || "") }));
          setUploadedImages(mapped);
        } catch (e) { setUploadedImages([]); }
      } else setUploadedImages([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blog]);

  useEffect(() => {
    if (!form.title) return;
    if (!form.slug) {
      const s = generateSlugFromTitle(form.title);
      setForm(prev => ({ ...prev, slug: s }));
    }
  }, [form.title]);

  const starterInst = createExtensionInstanceSafely(StarterKit);
  const imageInst = configureExtensionSafely(Image, { inline: false });
  const linkInst = configureExtensionSafely(Link, { openOnClick: false });
  const placeholderInst = configureExtensionSafely(Placeholder, { placeholder: "Write your post — use / to add blocks." });

  const extensionInstances = dedupeExtensionsByName([starterInst, imageInst, linkInst, placeholderInst]);

  const editor = useEditor({
    extensions: extensionInstances,
    content: form.content && form.content.html ? form.content.html : (form.content && form.content.markdown ? marked.parse(form.content.markdown) : ""),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = td.turndown(html);
      setForm(prev => ({ ...prev, content: { html, markdown } }));
    },
    editorProps: {
      attributes: { class: "prose prose-sm sm:prose lg:prose lg:max-w-none tiptap-content" }
    }
  });

  useEffect(() => {
    if (!editor) return;
    const html = form.content?.html || (form.content?.markdown ? marked.parse(form.content.markdown || "") : "");
    editor.commands.setContent(html);
  }, [editor, form.content]);

  function insertImageToEditor(url) {
    if (!editor || !url) { toast.error("Editor not ready"); return; }
    try {
      editor.chain().focus().setImage({ src: normalizeUploadUrl(url) }).run();
      toast.success("Image inserted");
    } catch (err) {
      console.warn("insertImageToEditor failed", err);
      toast.error("Insert failed");
    }
  }

  async function handleImageFile(file) {
    if (!file) return;
    try {
      const tId = toast.loading("Uploading image...");
      const raw = await uploadFile(file, { space: 'blogs' });
      const url = normalizeUploadUrl(raw || "");
      insertImageToEditor(url);
      let saved = null;
      try {
        const payload = { blog_id: form.id || null, url, caption: "" };
        const r = await apiPost("/blog-images", payload);
        if (r && (r.id || r.url)) saved = { id: r.id || null, url: normalizeUploadUrl(r.url || r.public_url || url) };
      } catch (e) { /* ignore */ }
      setUploadedImages(prev => {
        const entry = saved ? { id: saved.id, url: saved.url } : { url };
        if (prev.some(p => p.url === entry.url)) return prev;
        return [entry, ...prev];
      });
      toast.success("Image uploaded", { id: tId });
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        toast.error("Session expired — please sign in again.");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
        return;
      }
      toast.error("Upload failed");
    }
  }

  function onToolbarImageClick() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  async function save() {
    try {
      if (!form.title || !String(form.title).trim()) { toast.error("Post title is required"); return; }
      if (!form.slug || !String(form.slug).trim()) { toast.error("URL slug is required (lowercase, hyphens)"); return; }
      setBusy(true);

      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content || { html: "", markdown: "" },
        meta_title: form.meta_title,
        meta_description: form.meta_description,
        canonical_url: form.canonical_url,
        og_image: form.og_image,
        is_published: !!form.is_published
      };

      const safePayload = { ...payload };
      if (safePayload.og_image !== undefined) safePayload.og_image = safeAbsoluteImageUrl(safePayload.og_image, "blogs");

      if (form.id) {
        await apiPut(`/blogs/${encodeURIComponent(form.id)}`, safePayload);
        toast.success("Saved");
      } else {
        await apiPost("/blogs", safePayload);
        toast.success("Created");
      }
      onSaved && onSaved();
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        toast.error("Session expired — please sign in again.");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
        return;
      }
      if (e?.status === 409) toast.error("Slug already taken");
      else toast.error("Save failed");
    } finally { setBusy(false); }
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[140] flex items-start justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-6xl p-6 z-[141] overflow-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <h3 className="sprada-heading font-semibold text-lg">{form.id ? "Edit Blog Post" : "Create Blog Post"}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 border rounded-lg">Close</button>
            <button onClick={save} className="px-4 py-2 bg-[#0f6b5a] text-white rounded-lg" disabled={busy}>{busy ? "Saving…" : (form.id ? "Save changes" : "Create post")}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500">Post Title</label>
              <input value={form.title || ""} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">URL Slug</label>
              <input value={form.slug || ""} onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
              <div className="flex items-center gap-3 mt-1">
                <div className="text-xs text-slate-400">Tip: Keep it short and SEO-friendly</div>
                <button onClick={() => { const s = generateSlugFromTitle(form.title || ""); setForm(prev => ({ ...prev, slug: s })); toast.success("Slug generated"); }} className="text-xs px-2 py-1 border rounded">Generate slug</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="rounded-md border px-2 py-1 bg-white">
                <button onClick={() => setMode("wysiwyg")} className={`px-3 py-1 ${mode === "wysiwyg" ? "bg-[#0f6b5a] text-white rounded" : ""}`}>WYSIWYG</button>
                <button onClick={() => setMode("markdown")} className={`px-3 py-1 ${mode === "markdown" ? "bg-[#0f6b5a] text-white rounded" : ""}`}>Markdown</button>
                <button onClick={() => setMode("split")} className={`px-3 py-1 ${mode === "split" ? "bg-[#0f6b5a] text-white rounded" : ""}`}>Split</button>
              </div>
              <div className="text-xs text-slate-500">Tip: drag & drop images into the editor or use the image button. Press <strong>Ctrl/Cmd+S</strong> to save.</div>
            </div>

            <div id="tiptap-editor-shell" className="rounded-lg border overflow-hidden">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />

              <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-wrap">
                <button onClick={() => editor && editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-xs border rounded">B</button>
                <button onClick={() => editor && editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-xs border rounded">I</button>
                <button onClick={() => editor && editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 text-xs border rounded">• List</button>
                <button onClick={() => editor && editor.chain().focus().toggleOrderedList().run()} className="px-2 py-1 text-xs border rounded">1. List</button>
                <button onClick={() => onToolbarImageClick()} className="px-2 py-1 text-xs border rounded">Image</button>
                <button onClick={() => editor && editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 text-xs border rounded">HR</button>
              </div>

              {mode === "wysiwyg" && <div className="p-3"><EditorContent editor={editor} /></div>}

              {mode === "markdown" && (
                <textarea value={(form.content && form.content.markdown) || ""} onChange={e => {
                  const md = e.target.value;
                  const html = marked.parse(md);
                  setForm(prev => ({ ...prev, content: { html, markdown: md } }));
                  if (editor) editor.commands.setContent(html);
                }} className="w-full min-h-[340px] border-0 p-3 font-mono" placeholder="Write markdown here..." />
              )}

              {mode === "split" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3">
                  <div className="border rounded p-2 min-h-[260px]"><EditorContent editor={editor} /></div>
                  <div className="border rounded p-3 overflow-auto bg-gray-50 min-h-[260px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{(form.content && form.content.markdown) || td.turndown(form.content?.html || "") || ""}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Uploaded images</div>
                <div className="text-xs text-slate-500">Click insert to embed, delete to remove</div>
              </div>

              <div className="flex gap-3 overflow-auto py-2">
                {uploadedImages.length === 0 && <div className="text-slate-400 text-sm">No uploaded images yet</div>}
                {uploadedImages.map((img, idx) => (
                  <div key={img.id ? `i-${img.id}` : `u-${idx}`} className="flex flex-col items-center gap-2">
                    <img src={safeAbsoluteImageUrl(normalizeUploadUrl(img.url) || img.url)} alt={`img-${idx}`} className="uploaded-thumb" />
                    <div className="flex gap-1">
                      <button onClick={() => insertImageToEditor(img.url)} className="px-2 py-1 border rounded text-xs">Insert</button>
                      <button onClick={async () => {
                        if (!img.id) { setUploadedImages(prev => prev.filter(x => x.url !== img.url)); toast.success("Removed"); return; }
                        if (!window.confirm("Delete this uploaded image?")) return;
                        try { await apiDelete(`/blog-images/${encodeURIComponent(img.id)}`); setUploadedImages(prev => prev.filter(x => x.id !== img.id)); toast.success("Deleted"); }
                        catch (e) { console.error(e); toast.error("Delete failed"); }
                      }} className="px-2 py-1 border rounded text-xs text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 mt-2">
            <label className="block text-xs text-slate-500">Excerpt</label>
            <textarea value={form.excerpt || ""} onChange={e => setForm(prev => ({ ...prev, excerpt: e.target.value }))} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="Short summary (1-2 lines) to show in lists and previews." />
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500">Featured image URL</label>
              <input value={form.og_image || ""} onChange={e => setForm(prev => ({ ...prev, og_image: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="Paste an absolute image URL or upload via editor" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Meta title</label>
              <input value={form.meta_title || ""} onChange={e => setForm(prev => ({ ...prev, meta_title: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="Optional — overrides title for SEO" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Meta description</label>
              <input value={form.meta_description || ""} onChange={e => setForm(prev => ({ ...prev, meta_description: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="Short description for search engines (150-160 chars recommended)" />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ===========================
   BlogDetail modal component
   =========================== */
function BlogDetail({ blog, onClose, onChange }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(blog);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState({ likes_count: 0, user_liked: false });
  const [images, setImages] = useState((blog.images || []).map(i => ({ ...i, url: normalizeUploadUrl(i.url || i.public_url || i.path || "") })));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet(`/blogs/${encodeURIComponent(blog.slug)}`);
        const payload = res?.blog || (res?.ok ? res.blog : null);
        if (payload) {
          setDetail(payload);
          setImages((payload.images || []).map(i => ({ ...i, url: normalizeUploadUrl(i.url || i.public_url || i.path || "") })));
        }
      } catch (e) { /* ignore */ }
      await loadComments();
      await loadLikes();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blog.id]);

  async function loadComments() {
    try {
      const r = await apiGet(`/blogs/${encodeURIComponent(blog.id)}/comments`);
      setComments((r && r.comments) || []);
    } catch (e) {
      console.warn(e);
      if (e?.status === 401) {
        toast.error("Session expired");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
      }
    }
  }

  async function loadLikes() {
    try {
      const r = await apiGet(`/blogs/${encodeURIComponent(blog.id)}/likes`);
      setLikes(r || { likes_count: 0, user_liked: false });
    } catch (e) {
      console.warn(e);
      if (e?.status === 401) {
        toast.error("Session expired");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
      }
    }
  }

  async function approveComment(comment) {
    if (!window.confirm("Approve comment?")) return;
    try {
      setBusy(true);
      await apiPost(`/blogs/${encodeURIComponent(blog.id)}/comments/${encodeURIComponent(comment.id)}/approve`, {});
      await loadComments();
      toast.success("Comment approved");
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        toast.error("Session expired");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
      } else toast.error("Approve failed");
    } finally { setBusy(false); }
  }

  async function deleteComment(comment) {
    if (!window.confirm("Delete comment?")) return;
    try {
      setBusy(true);
      await apiDelete(`/blogs/${encodeURIComponent(blog.id)}/comments/${encodeURIComponent(comment.id)}`);
      await loadComments();
      toast.success("Deleted");
    } catch (e) {
      console.error(e);
      if (e?.status === 401) {
        toast.error("Session expired");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
      } else toast.error("Delete failed");
    } finally { setBusy(false); }
  }

  async function toggleLike() {
    try {
      await apiPost(`/blogs/${encodeURIComponent(blog.id)}/like`, {});
      await loadLikes();
    } catch (e) {
      console.warn(e);
      if (e?.status === 401) {
        toast.error("Session expired");
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); } catch(_) {}
        navigate("/login", { replace: true });
      }
    }
  }

  /* Portal modal */
  const HEADER_HEIGHT = 72;

  return ReactDOM.createPortal(
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: `${HEADER_HEIGHT}px 24px 24px`,
        zIndex: 2147483647,
        overflow: "auto",
        WebkitOverflowScrolling: "touch"
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.30)",
          zIndex: 2147483646
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2147483647,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(2,6,23,0.2)",
          width: "100%",
          maxWidth: "920px",
          padding: 24,
          maxHeight: `calc(100vh - ${HEADER_HEIGHT + 48}px)`,
          overflow: "auto"
        }}
        className="modal-blog-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <h3 className="sprada-heading font-semibold text-lg">{detail.title}</h3>
          </div>
          <div>
            <button className="px-3 py-2 border rounded-lg mr-2" onClick={onClose}>Close</button>
            <button className="px-3 py-2 border rounded-lg" onClick={() => onChange && onChange()}>Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="prose max-w-none">
              <div className="mb-3 text-sm text-slate-500">Excerpt</div>
              <p className="mb-4">{detail.excerpt}</p>

              <div className="mb-3 text-sm text-slate-500">Content (HTML)</div>

              <div className="p-3 border rounded-lg bg-gray-50">
                <div
                  className="prose max-w-none blog-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      DOMPurify.sanitize((detail.content && detail.content.html) || (detail.content && detail.content.markdown ? marked.parse(detail.content.markdown) : ""))
                  }}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="text-sm font-semibold">{likes.likes_count ?? 0} likes</div>
                <button
                  className={`px-3 py-1 border rounded ${likes.user_liked ? "bg-[#0f6b5a] text-white" : ""}`}
                  onClick={toggleLike}
                >
                  Toggle Like
                </button>
                <div className="text-sm text-slate-500">
                  {detail.published_at ? `Published ${new Date(detail.published_at).toLocaleString()}` : "Draft"}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-3">Comments</h4>
                {comments.length === 0 ? (
                  <div className="text-slate-500">No comments</div>
                ) : (
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{c.name || (c.user_id ? "User" : "Anonymous")}</div>
                            <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!c.is_published && (
                              <button onClick={() => approveComment(c)} className="px-2 py-1 border rounded text-xs bg-green-50">Approve</button>
                            )}
                            <button onClick={() => deleteComment(c)} className="px-2 py-1 border rounded text-xs text-red-600">Delete</button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm">{c.body}</div>
                        {c.rating && <div className="mt-1 text-xs text-slate-500">Rating: {c.rating}/5</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="p-3 border rounded-lg">
            <h5 className="font-semibold mb-2">Images</h5>
            <div className="grid grid-cols-1 gap-2">
              {images.length === 0 && <div className="text-slate-500">No images</div>}
              {images.map(img => (
                <div key={img.id || img.url} className="flex items-center gap-2">
                  <img src={safeAbsoluteImageUrl(normalizeUploadUrl(img.url) || img.url)} alt={img.caption || ""} className="w-20 h-14 object-cover rounded" />
                  <div className="flex-1">
                    <div className="text-sm">{img.caption || ""}</div>
                    <div className="text-xs text-slate-500">{img.created_at ? new Date(img.created_at).toLocaleString() : ""}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <h5 className="font-semibold mb-2">Quick Actions</h5>
              <button onClick={() => downloadBlog(detail)} className="w-full px-3 py-2 border rounded-lg mb-2">Download JSON</button>
              <button onClick={() => shareBlog(detail)} className="w-full px-3 py-2 border rounded-lg">Open on site</button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Utilities */
function downloadBlog(blog) {
  const data = JSON.stringify(blog, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blog-${blog.slug || blog.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function shareBlog(blog) {
  const url = blog.canonical_url || (blog.slug ? `${window.location.origin}/blog/${blog.slug}` : null);
  if (url) window.open(url, "_blank");
  else toast("No canonical/slug URL available");
}

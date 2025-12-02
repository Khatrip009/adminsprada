// src/pages/BlogEditorPage.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

import toast, { Toaster } from "react-hot-toast";
import TurndownService from "turndown";
import { marked } from "marked";
import DOMPurify from "dompurify";

import Sidebar from "../components/Sidebar";
import LOGO from "../assets/SPRADA_LOGO.png";

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  uploadFile,
  getBlogFlexible
} from "../lib/api";

/**
 * Blog Editor (block-first) - produces JSONB-friendly shape:
 *
 * {
 *   id, title, slug, excerpt, meta_title, meta_description, canonical_url, og_image, is_published,
 *   content: {
 *     blocks: [ { type: 'paragraph'|'heading'|'image'|'list'|'quote'|'code'|'gallery'|'cta'|'separator', ... } ],
 *     html: "<...>",
 *     markdown: "..."
 *   }
 * }
 *
 * This page shows editor UI for block-level editing, a WYSIWYG importer,
 * image uploads, reorder/delete of blocks, inline preview modal and "open preview" link.
 */

/* -------------------------
   Tiny helpers & styles
   ------------------------- */
function ensureFontsAndStyles() {
  if (typeof document === "undefined") return;
  if (!document.getElementById("sprada-editor-styles")) {
    const s = document.createElement("style");
    s.id = "sprada-editor-styles";
    s.innerHTML = `
      .sprada-heading { font-family: "Roboto Slab", serif; }
      .sprada-ui { font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto; }
      .block-panel { border-radius: 10px; background: #fff; }
      .small-muted { font-size: 12px; color: #6b7280; }
      .btn-primary { background: #0f6b5a; color: white; padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; }
      .btn-ghost { background: white; border: 1px solid #e6e6e6; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
      .block-box { border: 1px solid #eef2f7; padding: 12px; border-radius: 8px; background: #ffffff; }
    `;
    document.head.appendChild(s);
  }
}
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
function generateSlugFromTitle(title) {
  if (!title) return "";
  return String(title).toLowerCase().trim().replace(/[\u2018\u2019\u201C\u201D]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function estimateReadingTime(text) {
  if (!text) return { minutes: 0, words: 0 };
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { minutes, words };
}

/* -------------------------
   Simple block -> html renderer
   (used to build content.html for DB)
   ------------------------- */
function blocksToHTML(blocks = []) {
  const escape = s => DOMPurify.sanitize(String(s || ""));
  return blocks.map(b => {
    switch (b.type) {
      case "heading":
        return `<h${b.level||2}>${escape(b.text)}</h${b.level||2}>`;
      case "paragraph":
        return `<p>${escape(b.text)}</p>`;
      case "image":
        return `<figure><img src="${escape(b.url)}" alt="${escape(b.alt||"")}" /><figcaption>${escape(b.caption||"")}</figcaption></figure>`;
      case "list":
        return b.ordered ? `<ol>${(b.items||[]).map(i=>`<li>${escape(i)}</li>`).join("")}</ol>` : `<ul>${(b.items||[]).map(i=>`<li>${escape(i)}</li>`).join("")}</ul>`;
      case "quote":
        return `<blockquote><p>${escape(b.text)}</p>${b.author?`<footer>${escape(b.author)}</footer>`:""}</blockquote>`;
      case "code":
        return `<pre><code>${escape(b.code)}</code></pre>`;
      case "gallery":
        return `<div class="gallery">${(b.items||[]).map(it=>`<img src="${escape(it.url)}" alt="${escape(it.alt||"")}" />`).join("")}</div>`;
      case "cta":
        return `<div class="cta"><a href="${escape(b.url)}" class="btn">${escape(b.text)}</a></div>`;
      case "separator":
        return `<hr />`;
      default:
        return "";
    }
  }).join("\n");
}

/* -------------------------
   Block defaults factory
   ------------------------- */
function newBlock(type) {
  switch (type) {
    case "heading": return { type: "heading", level: 2, text: "" };
    case "paragraph": return { type: "paragraph", text: "" };
    case "image": return { type: "image", url: "", alt: "", caption: "" };
    case "list": return { type: "list", ordered: false, items: [""] };
    case "quote": return { type: "quote", text: "", author: "" };
    case "code": return { type: "code", code: "", language: "" };
    case "gallery": return { type: "gallery", items: [] };
    case "cta": return { type: "cta", text: "Read more", url: "#" };
    case "separator": return { type: "separator" };
    default: return { type: "paragraph", text: "" };
  }
}

/* -------------------------
   Preview component — professional corporate style
   (re-used for inline preview and for generating html)
   ------------------------- */
function BlogPreview({ blog }) {
  if (!blog) return null;
  const blocks = (blog.content && blog.content.blocks) || [];
  return (
    <article className="prose lg:prose-xl max-w-none mx-auto p-6">
      <header className="mb-6">
        <h1 className="sprada-heading text-3xl font-bold">{blog.title}</h1>
        <div className="text-sm text-slate-600 mb-3">{blog.author?.name || "Author"} • {blog.published_at ? new Date(blog.published_at).toLocaleDateString() : "Draft"}</div>
        {blog.og_image && <img src={normalizeUploadUrl(blog.og_image)} alt="" className="w-full h-72 object-cover rounded-lg mb-4" />}
        {blog.excerpt && <p className="text-slate-700">{blog.excerpt}</p>}
      </header>

      <section>
        {blocks.length === 0 ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((blog.content && blog.content.html) || "") }} />
        ) : (
          blocks.map((b, idx) => <BlockView key={idx} block={b} />)
        )}
      </section>

      <footer className="mt-10 border-t pt-6 text-sm text-slate-600">
        <div className="font-semibold">{blog.author?.name || ""}</div>
        <div>{blog.author?.bio || ""}</div>
      </footer>
    </article>
  );
}

function BlockView({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(Math.max(block.level || 2, 1), 4)}`;
      return <Tag className="font-semibold mt-6 mb-3">{block.text}</Tag>;
    }
    case "paragraph":
      return <p className="text-gray-700 leading-relaxed my-3">{block.text}</p>;
    case "image":
      return (
        <figure className="my-6">
          <img loading="lazy" src={normalizeUploadUrl(block.url)} alt={block.alt || ""} className="w-full rounded-md shadow-sm object-cover" />
          {block.caption && <figcaption className="text-sm text-gray-500 mt-2">{block.caption}</figcaption>}
        </figure>
      );
    case "list":
      return block.ordered ? (
        <ol className="list-decimal list-inside my-3 space-y-1">{(block.items || []).map((it, i) => <li key={i}>{it}</li>)}</ol>
      ) : (
        <ul className="list-disc list-inside my-3 space-y-1">{(block.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-slate-200 pl-4 italic text-gray-800 my-4">
          <div>{block.text}</div>
          {block.author && <footer className="mt-2 text-sm text-gray-600">— {block.author}</footer>}
        </blockquote>
      );
    case "code":
      return <pre className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto my-4"><code>{block.code}</code></pre>;
    case "gallery":
      return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">{(block.items || []).map((it, i) => <img key={i} src={normalizeUploadUrl(it.url)} alt={it.alt||""} className="w-full h-48 object-cover rounded" />)}</div>;
    case "cta":
      return <div className="my-6"><a href={block.url} className="inline-block px-6 py-3 rounded bg-[#0f6b5a] text-white">{block.text}</a></div>;
    case "separator":
      return <hr className="my-8 border-gray-200" />;
    default:
      return null;
  }
}

/* -------------------------
   Main page
   ------------------------- */
export default function BlogEditorPage({ mode: forcedMode } = {}) {
  ensureFontsAndStyles();
  const navigate = useNavigate();
  const params = useParams();
  const pageMode = forcedMode || (params.id ? "edit" : "new");
  const blogIdParam = params.id || null;

  const [form, setForm] = useState({
    id: null,
    title: "",
    slug: "",
    excerpt: "",
    content: { blocks: [], html: "", markdown: "" },
    meta_title: "",
    meta_description: "",
    canonical_url: "",
    og_image: "",
    is_published: false,
    published_at: null
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localDraftKey] = useState(blogIdParam ? `draft:blog:${blogIdParam}` : `draft:blog:new`);
  const td = useRef(new TurndownService()).current;
  const [autosaveStatus, setAutosaveStatus] = useState("idle");

  /* TipTap for freeform import */
  const starterInst = StarterKit;
  const imageInst = Image;
  const linkInst = Link;
  const placeholderInst = Placeholder;

  const editor = useEditor({
    extensions: [starterInst, imageInst, linkInst, placeholderInst.configure ? placeholderInst.configure({ placeholder: "Use this to paste content then Import" }) : placeholderInst],
    content: "",
    editorProps: { attributes: { class: "prose lg:prose-lg tiptap-content" } },
    onUpdate: ({ editor }) => {
      // we don't sync editor into blocks automatically, it's used as "import source"
    }
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!pageMode || pageMode === "new") {
        // restore local draft
        try {
          const raw = localStorage.getItem(localDraftKey);
          if (raw) {
            const d = JSON.parse(raw);
            if (d && window.confirm("Restore unsaved draft?")) {
              setForm(prev => ({ ...prev, ...d }));
              toast.success("Draft restored");
            }
          }
        } catch (e) { /* ignore */ }
        setLoading(false);
        return;
      }
      if (pageMode === "edit" && blogIdParam) {
        setLoading(true);
        try {
          const payload = await getBlogFlexible(blogIdParam);
          const normalized = payload?.blog ? payload.blog : payload;
          if (!normalized) throw new Error("Not found");
          const data = {
            ...form,
            ...normalized,
            og_image: normalizeUploadUrl(normalized?.og_image || ""),
            content: normalized.content || { blocks: [], html: "", markdown: "" }
          };
          if (!mounted) return;
          setForm(data);
          // fetch blog images if endpoint exists
          try {
            const r = await apiGet(`/blog-images?blog_id=${encodeURIComponent(data.id)}`);
            const imgs = r && (r.images || (Array.isArray(r) ? r : [])) || [];
            setUploadedImages(imgs.map(it => ({ id: it.id, url: normalizeUploadUrl(it.url || it.public_url || it.path || ""), caption: it.caption || "" })));
          } catch (e) { setUploadedImages([]); }
        } catch (err) {
          console.error("load blog", err);
          toast.error("Failed loading blog");
          navigate("/dashboard/blogs");
        } finally {
          if (mounted) setLoading(false);
        }
      }
    }
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogIdParam, pageMode]);

  /* Small block operations */
  function addBlock(type, index = null) {
    const b = newBlock(type);
    setForm(prev => {
      const blocks = [...(prev.content.blocks || [])];
      if (index === null) blocks.push(b);
      else blocks.splice(index, 0, b);
      return { ...prev, content: { ...prev.content, blocks } };
    });
    setDirty(true);
  }
  function updateBlock(i, partial) {
    setForm(prev => {
      const blocks = [...(prev.content.blocks || [])];
      blocks[i] = { ...blocks[i], ...partial };
      return { ...prev, content: { ...prev.content, blocks } };
    });
    setDirty(true);
  }
  function removeBlock(i) {
    setForm(prev => {
      const blocks = [...(prev.content.blocks || [])];
      blocks.splice(i, 1);
      return { ...prev, content: { ...prev.content, blocks } };
    });
    setDirty(true);
  }
  function moveBlock(i, dir) {
    setForm(prev => {
      const blocks = [...(prev.content.blocks || [])];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return prev;
      const tmp = blocks[i];
      blocks[i] = blocks[j];
      blocks[j] = tmp;
      return { ...prev, content: { ...prev.content, blocks } };
    });
    setDirty(true);
  }

  /* Upload helpers */
  async function handleUploadFileAsUrl(file) {
    if (!file) return null;
    const id = toast.loading("Uploading image...");
    try {
      const raw = await uploadFile(file, { space: "blogs" });
      const url = normalizeUploadUrl(raw);
      toast.success("Uploaded", { id });
      return url;
    } catch (e) {
      toast.error("Upload failed", { id });
      console.error(e);
      return null;
    }
  }

  async function handleImageFileAndInsert(i) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const url = await handleUploadFileAsUrl(f);
      if (!url) return;
      setUploadedImages(prev => [{ id: null, url, caption: "" }, ...prev]);
      if (i !== undefined && i !== null) {
        // insert into a gallery at block index i if it's a gallery block
        setForm(prev => {
          const blocks = [...(prev.content.blocks || [])];
          const blk = blocks[i];
          if (blk && blk.type === "gallery") {
            blk.items = [{ url, alt: "" }, ...(blk.items||[])];
            blocks[i] = blk;
          } else {
            // otherwise add image block after i
            blocks.splice(i+1, 0, { type: "image", url, alt: "", caption: "" });
          }
          return { ...prev, content: { ...prev.content, blocks } };
        });
      } else {
        // append an image block
        addBlock("image");
        // small delay then set url to last block
        setTimeout(() => {
          setForm(prev => {
            const blocks = [...(prev.content.blocks || [])];
            const last = blocks.length - 1;
            if (blocks[last] && blocks[last].type === "image") blocks[last].url = url;
            return { ...prev, content: { ...prev.content, blocks } };
          });
        }, 120);
      }
      setDirty(true);
    };
    input.click();
  }

  /* Convert blocks to html/markdown before save */
  function finalizeContentForSave() {
    const blocks = form.content.blocks || [];
    const html = blocksToHTML(blocks);
    const markdown = td.turndown(html || "");
    return { blocks, html, markdown };
  }

  /* Import TipTap content as a single paragraph block */
  function importFromEditor() {
    if (!editor) return;
    const html = editor.getHTML();
    const text = (editor.getText && editor.getText()) || "";
    const p = { type: "paragraph", text: DOMPurify.sanitize(text) };
    setForm(prev => ({ ...prev, content: { ...prev.content, blocks: [...(prev.content.blocks||[]), p] } }));
    toast.success("Imported content as paragraph block");
    setDirty(true);
  }

  /* Autosave to server/local */
  useEffect(() => {
    let mounted = true;
    const id = setInterval(async () => {
      if (!dirty) return;
      setAutosaveStatus("saving");
      try {
        const payloadContent = finalizeContentForSave();
        const payload = {
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          content: payloadContent,
          meta_title: form.meta_title,
          meta_description: form.meta_description,
          canonical_url: form.canonical_url,
          og_image: form.og_image,
          is_published: !!form.is_published
        };
        if (form.id) {
          await apiPut(`/blogs/${encodeURIComponent(form.id)}`, payload);
          setAutosaveStatus("saved");
          setDirty(false);
        } else {
          // create a draft (not published)
          try {
            const created = await apiPost("/blogs", { ...payload, is_published: false });
            const idVal = created && (created.blog?.id || created.id || (created.blog || null));
            if (idVal) {
              setForm(prev => ({ ...prev, id: idVal }));
              // try to persist pending images (best-effort)
            }
            setAutosaveStatus("saved");
            setDirty(false);
          } catch (e) {
            // fallback to localStorage
            try {
              const snap = { ...form, content: payloadContent, updated_at: new Date().toISOString() };
              localStorage.setItem(localDraftKey, JSON.stringify(snap));
              setAutosaveStatus("saved");
              setDirty(false);
            } catch (err) {
              setAutosaveStatus("failed");
            }
          }
        }
      } catch (err) {
        console.error("autosave", err);
        setAutosaveStatus("failed");
      }
    }, 10000);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, form]);

  /* Save handler */
  async function saveHandler({ publish = false, back = false } = {}) {
    try {
      if (!form.title || !form.title.trim()) { toast.error("Title required"); return; }
      if (!form.slug || !form.slug.trim()) { toast.error("Slug required"); return; }
      setSaving(true);
      const content = finalizeContentForSave();
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content,
        meta_title: form.meta_title,
        meta_description: form.meta_description,
        canonical_url: form.canonical_url,
        og_image: form.og_image,
        is_published: !!publish || !!form.is_published
      };
      if (form.id) {
        await apiPut(`/blogs/${encodeURIComponent(form.id)}`, payload);
        toast.success(publish ? "Published" : "Saved");
        setForm(prev => ({ ...prev, content, is_published: publish ? true : prev.is_published }));
      } else {
        const created = await apiPost("/blogs", payload);
        const idVal = created && (created.blog?.id || created.id || (created.blog || null));
        if (idVal) {
          setForm(prev => ({ ...prev, id: idVal, content, is_published: publish ? true : prev.is_published }));
          toast.success("Created");
        } else {
          toast.success("Created");
          setForm(prev => ({ ...prev, content }));
        }
      }
      setDirty(false);
      setAutosaveStatus("saved");
      if (back) navigate("/dashboard/blogs");
    } catch (err) {
      console.error("saveHandler", err);
      if (err?.status === 409) toast.error("Slug already taken");
      else if (err?.status === 401) {
        toast.error("Session expired");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        navigate("/login");
      } else toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publishToggle() {
    try {
      if (!form.id) { await saveHandler({ publish: true }); return; }
      const publish = !form.is_published;
      await apiPost(`/blogs/${encodeURIComponent(form.id)}/publish`, { publish });
      setForm(prev => ({ ...prev, is_published: publish }));
      toast.success(publish ? "Published" : "Unpublished");
    } catch (e) {
      console.error(e);
      toast.error("Publish failed");
    }
  }

  function openSitePreview() {
    const slugOrId = form.slug || form.id;
    if (!slugOrId) { toast.error("Save the post first to preview on site"); return; }
    const url = form.slug ? `${window.location.origin}/blog/${form.slug}?preview=true` : `${window.location.origin}/blog/${form.id}?preview=true`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /* Keyboard save */
  useEffect(() => {
    function onKey(e) {
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (isSave) {
        e.preventDefault();
        saveHandler();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editor]);

  /* Drag/paste images into the page area */
  useEffect(() => {
    function prevent(e) { e.preventDefault(); e.stopPropagation(); }
    async function onDrop(e) {
      prevent(e);
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith("image/")) {
        const url = await handleUploadFileAsUrl(f);
        if (url) {
          setUploadedImages(prev => [{ id: null, url, caption: "" }, ...prev]);
          setForm(prev => ({ ...prev, content: { ...prev.content, blocks: [...(prev.content.blocks||[]), { type: "image", url, alt: "", caption: "" }] } }));
        }
      }
    }
    function onPaste(e) {
      try {
        const items = e.clipboardData?.items || [];
        for (const it of items) {
          if (it.kind === "file") {
            const f = it.getAsFile();
            if (f && f.type.startsWith("image/")) {
              handleUploadFileAsUrl(f).then(url => {
                if (url) {
                  setUploadedImages(prev => [{ id: null, url, caption: "" }, ...prev]);
                  setForm(prev => ({ ...prev, content: { ...prev.content, blocks: [...(prev.content.blocks||[]), { type: "image", url, alt: "", caption: "" }] } }));
                }
              });
              break;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.content.blocks, uploadedImages]);

  /* Derived stats */
  const plain = (form.content && (form.content.markdown || td.turndown(form.content.html || ""))) || "";
  const readingStats = estimateReadingTime(plain);
  const wordCount = readingStats.words;

  /* UI render */
  return (
    <div className="min-h-screen sprada-ui bg-gray-50">
      <Toaster position="bottom-right" />
      <div className="flex">
        <Sidebar user={JSON.parse(localStorage.getItem("user") || "null")} className="w-72" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img src={LOGO} className="w-36 object-contain" alt="logo" />
              <div>
                <h1 className="sprada-heading text-2xl text-[#0f6b5a] font-semibold">{pageMode === "edit" ? "Edit Blog (JSONB)" : "Create Blog (JSONB)"}</h1>
                <div className="text-sm text-slate-500">Block-first editor — produces JSONB `content.blocks` + HTML/markdown.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">Signed in as</div>
              <div className="px-3 py-2 bg-white border rounded-lg text-sm shadow-sm">{(JSON.parse(localStorage.getItem("user")||"null"))?.name || "Admin"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
            {/* left: editor */}
            <section className="block-panel p-6 bg-white rounded-lg shadow-sm">
              <input value={form.title || ""} onChange={e => { setForm(prev => ({ ...prev, title: e.target.value })); if (!form.slug) setForm(prev => ({ ...prev, slug: generateSlugFromTitle(e.target.value) })); setDirty(true); }} placeholder="Title" className="w-full text-3xl font-semibold border-0 outline-none mb-3" />

              <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                <div>/{form.slug || "slug-here"}</div>
                <div>•</div>
                <div>{form.is_published ? `Published ${form.published_at ? new Date(form.published_at).toLocaleDateString() : ""}` : "Draft"}</div>
                <div className="ml-auto text-xs text-slate-400">Autosave: {autosaveStatus}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button className="btn-primary" onClick={() => saveHandler({})} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  <button className="btn-ghost" onClick={() => saveHandler({ publish: true })}>Save & Publish</button>
                  <button className="btn-ghost" onClick={publishToggle}>{form.is_published ? "Unpublish" : "Publish"}</button>
                  <button className="btn-ghost" onClick={() => setPreviewOpen(true)}>Inline Preview</button>
                  <button className="btn-ghost" onClick={openSitePreview}>Open site preview</button>
                </div>

                <div className="text-xs text-slate-500">Tip: paste content into the WYSIWYG area and use "Import" to convert it into a paragraph block.</div>
              </div>

              {/* TipTap WYSIWYG importer */}
              <div className="mb-4 border rounded p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">WYSIWYG (Paste here to import)</div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 border rounded text-sm" onClick={() => { if (editor) editor.commands.clearContent(); }}>Clear</button>
                    <button className="px-2 py-1 border rounded text-sm" onClick={() => importFromEditor()}>Import</button>
                  </div>
                </div>
                <div className="rounded bg-white p-2" style={{ minHeight: 120 }}>
                  <EditorContent editor={editor} />
                </div>
              </div>

              {/* Blocks list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Content blocks</h4>
                  <div className="flex items-center gap-2">
                    <select id="add-block-select" className="border rounded px-2 py-1 text-sm" onChange={(e) => { const v = e.target.value; if (!v) return; addBlock(v); e.target.selectedIndex = 0; }}>
                      <option value="">Add block...</option>
                      <option value="heading">Heading</option>
                      <option value="paragraph">Paragraph</option>
                      <option value="image">Image</option>
                      <option value="list">List</option>
                      <option value="quote">Quote</option>
                      <option value="code">Code</option>
                      <option value="gallery">Gallery</option>
                      <option value="cta">CTA</option>
                      <option value="separator">Separator</option>
                    </select>
                    <button className="px-2 py-1 border rounded text-sm" onClick={() => addBlock("paragraph")}>+ Paragraph</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(form.content.blocks || []).map((blk, i) => (
                    <div key={i} className="block-box">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">{blk.type.toUpperCase()} {blk.type === "heading" ? `H${blk.level}` : ""}</div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => moveBlock(i, -1)} className="px-2 py-1 border rounded text-xs">↑</button>
                              <button onClick={() => moveBlock(i, 1)} className="px-2 py-1 border rounded text-xs">↓</button>
                              <button onClick={() => removeBlock(i)} className="px-2 py-1 border rounded text-xs text-red-600">Delete</button>
                            </div>
                          </div>

                          {/* Block specific editors */}
                          {blk.type === "heading" && (
                            <div>
                              <input value={blk.text || ""} onChange={e => updateBlock(i, { text: e.target.value })} placeholder="Heading text" className="w-full border rounded px-2 py-1 mb-2" />
                              <div className="text-xs small-muted">Level:
                                <select value={blk.level || 2} onChange={e => updateBlock(i, { level: Number(e.target.value) })} className="ml-2 border rounded px-2 py-1 text-sm">
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                  <option value={3}>3</option>
                                  <option value={4}>4</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {blk.type === "paragraph" && (
                            <textarea value={blk.text || ""} onChange={e => updateBlock(i, { text: e.target.value })} className="w-full border rounded p-2" rows={4} placeholder="Paragraph text" />
                          )}

                          {blk.type === "image" && (
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center gap-2">
                                <input value={blk.url || ""} onChange={e => updateBlock(i, { url: e.target.value })} placeholder="Image URL" className="w-full border rounded px-2 py-1" />
                                <button className="px-2 py-1 border rounded" onClick={() => handleImageFileAndInsert(i)}>Upload</button>
                              </div>
                              <input value={blk.caption || ""} onChange={e => updateBlock(i, { caption: e.target.value })} placeholder="Caption (optional)" className="w-full border rounded px-2 py-1" />
                              <input value={blk.alt || ""} onChange={e => updateBlock(i, { alt: e.target.value })} placeholder="Alt text (accessibility)" className="w-full border rounded px-2 py-1" />
                            </div>
                          )}

                          {blk.type === "list" && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <label className="text-xs small-muted">Ordered</label>
                                <input type="checkbox" checked={blk.ordered || false} onChange={e => updateBlock(i, { ordered: e.target.checked })} />
                              </div>
                              <textarea value={(blk.items || []).join("\n")} onChange={e => updateBlock(i, { items: e.target.value.split("\n") })} className="w-full border rounded p-2" rows={4} placeholder="One item per line" />
                            </div>
                          )}

                          {blk.type === "quote" && (
                            <div>
                              <textarea value={blk.text || ""} onChange={e => updateBlock(i, { text: e.target.value })} className="w-full border rounded p-2 mb-2" rows={3} placeholder="Quote text" />
                              <input value={blk.author || ""} onChange={e => updateBlock(i, { author: e.target.value })} placeholder="Author (optional)" className="w-full border rounded px-2 py-1" />
                            </div>
                          )}

                          {blk.type === "code" && (
                            <div>
                              <textarea value={blk.code || ""} onChange={e => updateBlock(i, { code: e.target.value })} className="w-full border rounded p-2" rows={6} placeholder="Code snippet" />
                              <input value={blk.language || ""} onChange={e => updateBlock(i, { language: e.target.value })} placeholder="Language (optional)" className="w-full border rounded px-2 py-1 mt-2" />
                            </div>
                          )}

                          {blk.type === "gallery" && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <button className="px-2 py-1 border rounded" onClick={() => handleImageFileAndInsert(i)}>Upload image to gallery</button>
                                <button className="px-2 py-1 border rounded" onClick={() => {
                                  const items = [...(blk.items||[]), { url: "", alt: "" }];
                                  updateBlock(i, { items });
                                }}>Add placeholder</button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(blk.items || []).map((it, idx) => (
                                  <div key={idx} className="border rounded p-2">
                                    <input value={it.url || ""} onChange={e => {
                                      const items = [...(blk.items||[])]; items[idx] = { ...items[idx], url: e.target.value }; updateBlock(i, { items });
                                    }} placeholder="Image URL" className="w-full border rounded px-2 py-1 mb-1" />
                                    <input value={it.alt || ""} onChange={e => {
                                      const items = [...(blk.items||[])]; items[idx] = { ...items[idx], alt: e.target.value }; updateBlock(i, { items });
                                    }} placeholder="Alt text" className="w-full border rounded px-2 py-1 mb-1" />
                                    <div className="flex gap-2">
                                      <button onClick={() => {
                                        const items = [...(blk.items||[])]; items.splice(idx, 1); updateBlock(i, { items });
                                      }} className="px-2 py-1 border rounded text-xs text-red-600">Remove</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {blk.type === "cta" && (
                            <div>
                              <input value={blk.text || ""} onChange={e => updateBlock(i, { text: e.target.value })} placeholder="Button text" className="w-full border rounded px-2 py-1 mb-2" />
                              <input value={blk.url || ""} onChange={e => updateBlock(i, { url: e.target.value })} placeholder="URL" className="w-full border rounded px-2 py-1" />
                            </div>
                          )}

                          {blk.type === "separator" && <div className="text-xs text-slate-400">Separator block — no settings.</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </section>

            {/* right: metadata */}
            <aside className="block-panel p-4 bg-white rounded-lg shadow-sm">
              <div className="mb-3">
                <label className="text-xs small-muted">Slug</label>
                <input value={form.slug || ""} onChange={e => { setForm(prev => ({ ...prev, slug: e.target.value })); setDirty(true); }} className="w-full border rounded px-2 py-2" />
              </div>

              <div className="mb-3">
                <label className="text-xs small-muted">Excerpt</label>
                <textarea value={form.excerpt || ""} onChange={e => { setForm(prev => ({ ...prev, excerpt: e.target.value })); setDirty(true); }} className="w-full border rounded px-2 py-2" rows={3} />
              </div>

              <div className="mb-3">
                <label className="text-xs small-muted">Featured image (og)</label>
                <input value={form.og_image || ""} onChange={e => setForm(prev => ({ ...prev, og_image: e.target.value }))} className="w-full border rounded px-2 py-2" />
                <div className="flex gap-2 mt-2">
                  <button className="btn-ghost w-full" onClick={async () => {
                    const url = await handleUploadFileAsUrl(await (await new Promise(resolve => {
                      const inp = document.createElement("input");
                      inp.type = "file";
                      inp.accept = "image/*";
                      inp.onchange = e => resolve(e.target.files?.[0]);
                      inp.click();
                    })));
                    if (url) setForm(prev => ({ ...prev, og_image: url }));
                  }}>Upload</button>
                  <button className="btn-ghost w-full" onClick={() => setForm(prev => ({ ...prev, og_image: "" }))}>Remove</button>
                </div>
                {form.og_image && <img src={normalizeUploadUrl(form.og_image)} alt="og" className="w-full h-24 object-cover rounded mt-2" />}
              </div>

              <div className="mb-3">
                <label className="text-xs small-muted">Meta title</label>
                <input value={form.meta_title || ""} onChange={e => setForm(prev => ({ ...prev, meta_title: e.target.value }))} className="w-full border rounded px-2 py-2" />
              </div>

              <div className="mb-3">
                <label className="text-xs small-muted">Meta description</label>
                <textarea value={form.meta_description || ""} onChange={e => setForm(prev => ({ ...prev, meta_description: e.target.value }))} className="w-full border rounded px-2 py-2" rows={3} />
              </div>

              <div className="mb-3">
                <label className="text-xs small-muted">Canonical URL</label>
                <input value={form.canonical_url || ""} onChange={e => setForm(prev => ({ ...prev, canonical_url: e.target.value }))} className="w-full border rounded px-2 py-2" />
              </div>

              <div className="mb-3">
                <div className="text-xs small-muted">Status</div>
                <div className="mt-1 text-sm">{form.is_published ? "Published" : (dirty ? "Unsaved changes" : "Draft")}</div>
                <div className="text-xs text-slate-400 mt-2">Word count: {wordCount} • Est. read: {readingStats.minutes} min</div>
              </div>

              <div className="flex gap-2">
                <button className="btn-ghost w-full" onClick={() => saveHandler({ back: true })}>Save & Back</button>
                <button className="btn-ghost w-full" onClick={() => setPreviewOpen(true)}>Preview</button>
              </div>
            </aside>
          </div>

          {/* inline preview modal */}
          {previewOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
              <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 z-10 overflow-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                  <div><h4 className="font-semibold">Preview — {form.title}</h4><div className="text-xs text-slate-500">{form.excerpt}</div></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreviewOpen(false)} className="px-3 py-1 border rounded">Close</button>
                    <button onClick={openSitePreview} className="px-3 py-1 border rounded">Open site preview</button>
                  </div>
                </div>

                <BlogPreview blog={form} />
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// src/pages/Products.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar"; // adjust path if needed
import LOGO from "../assets/SPRADA_LOGO.png"; // ensure file exists

// toast
import { Toaster, toast } from "react-hot-toast";

// API helpers (expected to exist in your lib)
import {
  getCategories,
  getProducts,
  apiPost,
  apiPut,
  apiDelete,
  uploadFile, // should exist in your lib (handles S3 presign or local fallback)
  createProductImage,
  getProductImages,
  deleteProductImage,
  patchProductImage,
  toAbsoluteImageUrl,
  API_ORIGIN
} from "../lib/api";
import clsx from "clsx";
import dayjs from "dayjs";

/* ---------------------------
   Small helpers
   --------------------------- */

function normalizeUploadUrl(url) {
  if (!url) return url;
  try {
    if (url.startsWith("/")) return url;
    if (url.startsWith("data:")) return url;
    const u = new URL(url, window.location.origin);
    if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && (u.port === "4200" || u.port === "")) {
      return u.pathname + u.search + u.hash;
    }
    return u.href;
  } catch (e) {
    return url;
  }
}

function ensureFontsInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("sprada-fonts")) return;
  const link = document.createElement("link");
  link.id = "sprada-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Roboto+Slab:wght@400;600&display=swap";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.id = "sprada-theme";
  style.innerHTML = `
    :root{
      --sprada-accent: #0f6b5a;
      --sprada-accent-2: #0b8f6b;
      --sprada-muted: #6b7280;
      --sprada-card: #ffffff;
      --sprada-surface: #f8fafb;
      --sprada-ring: rgba(15,107,90,0.18);
      --ui-radius: 12px;
      --shadow-1: 0 6px 18px rgba(14, 28, 37, 0.06);
    }
    body { font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
    .sprada-heading { font-family: "Roboto Slab", Georgia, serif; }
  `;
  document.head.appendChild(style);
}

/* ---------------------------
   Utility: robust categories loader (tries include_counts)
   --------------------------- */
async function loadCategoriesWithCounts() {
  // try a few ways depending on how getCategories is implemented
  try {
    // prefer an options object (common wrapper signature)
    const r1 = await getCategories({ include_counts: true });
    if (Array.isArray(r1)) return r1;
    if (r1?.categories) return r1.categories;
  } catch (e) {
    // ignore and try alternative
  }

  try {
    // some libs accept query string
    const r2 = await getCategories("?include_counts=true");
    if (Array.isArray(r2)) return r2;
    if (r2?.categories) return r2.categories;
  } catch (e) {
    // fallback
  }

  try {
    const r3 = await getCategories();
    if (Array.isArray(r3)) return r3;
    if (r3?.categories) return r3.categories;
    return [];
  } catch (e) {
    console.warn("[loadCategoriesWithCounts] failed:", e);
    return [];
  }
}

/* ---------------------------
   Badge helper
   --------------------------- */
function TradeBadge({ trade }) {
  const t = (trade || "both").toLowerCase();
  if (t === "import") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800"
        aria-label="Import"
        title="Import"
      >
        Import
      </span>
    );
  }
  if (t === "export") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800"
        aria-label="Export"
        title="Export"
      >
        Export
      </span>
    );
  }
  // both / default
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800"
      aria-label="Both"
      title="Both"
    >
      Both
    </span>
  );
}

/* ---------------------------
   Image helpers (new, defensive)
   - Prevent attempts to load local FS paths like /mnt/ or C:\ which cause 404s.
   - Convert safe relative /uploads paths to absolute using toAbsoluteImageUrl().
   --------------------------- */

function isLocalFilesystemPath(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.toLowerCase();
  if (v.startsWith("/mnt/")) return true;
  if (v.startsWith("c:\\") || v.startsWith("d:\\")) return true;
  if (v.startsWith("file://")) return true;
  if (v.includes("\\users\\")) return true;
  return false;
}

/**
 * Return an absolute public URL for image or null if it's unsafe (local fs).
 * Uses toAbsoluteImageUrl() for conversion and also tolerates already-absolute URLs.
 */
function safeAbsoluteImageUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  // If it's already absolute and http(s) - keep it
  if (/^https?:\/\//i.test(raw)) return raw;
  // If it's a data URL, keep it
  if (/^data:/i.test(raw)) return raw;
  // If it looks like local FS path, block it (return null)
  if (isLocalFilesystemPath(raw)) return null;

  // Convert relative/partial uploads paths
  try {
    const abs = toAbsoluteImageUrl(raw);
    if (!abs) return null;
    if (/\/mnt\//i.test(abs)) return null;
    return abs;
  } catch (e) {
    return null;
  }
}

/**
 * Normalize product payload image fields before save.
 * Ensures og_image / primary_image / metadata.og_image are absolute URLs or null.
 */
function normalizeBeforeSave(payload = {}) {
  const out = { ...payload };

  function normField(v, space = "products") {
    if (!v) return null;
    if (isLocalFilesystemPath(v)) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/(?:src\/)?uploads\//i.test(v)) {
      // prefix API origin
      return `${API_ORIGIN}${v}`;
    }
    if (/^(?:src\/)?uploads\//i.test(v)) {
      return `${API_ORIGIN}/${v.replace(/^\/+/, "")}`;
    }
    // bare filename -> assume uploads/<space>/<filename>
    if (!v.startsWith("/")) {
      return `${API_ORIGIN}/uploads/${space}/${v.replace(/^\/+/, "")}`;
    }
    // fallback prefix
    return `${API_ORIGIN}${v}`;
  }

  if (out.og_image !== undefined) out.og_image = normField(out.og_image, "products");
  if (out.primary_image !== undefined) out.primary_image = normField(out.primary_image, "products");
  if (out.metadata && typeof out.metadata === "object" && out.metadata.og_image !== undefined) {
    out.metadata = { ...out.metadata, og_image: normField(out.metadata.og_image, "products") };
  }

  return out;
}

/* ---------------------------
   Main Page
   --------------------------- */
export default function ProductsPage() {
  useEffect(() => {
    ensureFontsInjected();
  }, []);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div className="min-h-screen flex bg-[color:var(--sprada-surface)] text-slate-800">
      <Toaster position="top-right" />
      <Sidebar user={user} className="w-72" />
      <main className="flex-1 p-6 max-w-full">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <img src={LOGO} alt="Sprada" className="w-36 object-contain" />
              <div>
                <h1 className="text-2xl sprada-heading font-semibold text-[color:var(--sprada-accent)]">Products</h1>
                <div className="text-sm text-[color:var(--sprada-muted)]">Manage products, categories & image gallery</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-[color:var(--sprada-muted)]">Signed in as</div>
            <div className="px-3 py-2 bg-white border rounded-lg shadow-sm text-sm">{user?.name || user?.username || "Admin"}</div>
          </div>
        </header>

        <div className="bg-[color:var(--sprada-card)] rounded-2xl shadow-[var(--shadow-1)] p-5">
          <ProductsAdmin />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------
   ProductsAdmin
   - Handles product list + inline category manager (CRUD)
   --------------------------- */
function ProductsAdmin() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [q, setQ] = useState("");
  const [order, setOrder] = useState("created_at.desc");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tradeTypeFilter, setTradeTypeFilter] = useState(""); // new filter: import/export/both
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // load categories (with counts) on mount
  async function refreshCategories() {
    try {
      const c = await loadCategoriesWithCounts();
      // normalize shape: ensure product_count present and trade_type default
      const normalized = (c || []).map((x) => {
        return {
          ...x,
          product_count: x.product_count ?? x.productCount ?? x.product_count ?? 0,
          trade_type: x.trade_type || x.tradeType || "both",
        };
      });
      setCats(normalized);
      return normalized;
    } catch (e) {
      console.warn("load categories", e);
      setCats([]);
      return [];
    }
  }

  useEffect(() => {
    refreshCategories();
  }, []);

  async function load({ pageArg = page, limitArg = limit, qArg = q, categoryArg = categoryFilter, orderArg = order, tradeTypeArg = tradeTypeFilter } = {}) {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: pageArg,
        limit: limitArg,
        q: qArg,
        category_id: categoryArg || undefined,
        order: orderArg,
      };
      if (tradeTypeArg) params.trade_type = tradeTypeArg;

      const data = await getProducts(params);
      const arr = Array.isArray(data) ? data : (data?.products || []);
      const normalized = (arr || []).map((p) => ({
        ...p,
        primary_image: normalizeUploadUrl(p.primary_image || p.og_image || p.thumbnail || p.image || ""),
        trade_type: p.trade_type ?? null,
        effective_trade_type: p.effective_trade_type ?? (p.category?.trade_type || "both"),
      }));
      setProducts(normalized);
    } catch (e) {
      console.error(e);
      setError("Failed loading products");
      toast.error("Failed loading products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, q, categoryFilter, order, tradeTypeFilter]);

  function openCreate() {
    setEditing({ title: "", slug: "", price: 0, currency: "USD", moq: 1, trade_type: null });
    setShowForm(true);
  }
  function openEdit(p) {
    setEditing(p);
    setShowForm(true);
  }

  async function onDelete(p) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await apiDelete(`/products/${encodeURIComponent(p.id)}`);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      setMessage("Deleted");
      setTimeout(() => setMessage(""), 2500);
      toast.success("Product deleted");
    } catch (e) {
      console.error(e);
      setError("Delete failed");
      toast.error("Delete failed");
    }
  }

  function exportCSV() {
    if (!products || !products.length) return;
    const headers = ["id", "sku", "title", "slug", "price", "currency", "category", "trade_type"];
    const lines = [headers.join(",")].concat(
      products.map((p) => {
        const values = [
          p.id || "",
          p.sku || "",
          (p.title || "").replace(/"/g, '""'),
          p.slug || "",
          p.price || "",
          p.currency || "",
          p.category?.name || "",
          p.trade_type || p.effective_trade_type || "both",
        ];
        return values.map((v) => (String(v).includes(",") ? `"${String(v)}"` : String(v))).join(",");
      })
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-2 transition-colors hover:shadow-sm bg-white"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.product_count !== undefined ? `• ${c.product_count}` : ""} {c.trade_type ? `(${c.trade_type})` : ""}
              </option>
            ))}
          </select>

          <select
            value={tradeTypeFilter}
            onChange={(e) => { setTradeTypeFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 bg-white"
            aria-label="Filter by trade type"
          >
            <option value="">All trade types</option>
            <option value="import">Import</option>
            <option value="export">Export</option>
            <option value="both">Both</option>
          </select>

          <input
            placeholder="Search products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded-lg px-3 py-2 w-56 transition-shadow focus:shadow-outline"
            aria-label="Search products"
          />
          <select value={order} onChange={(e) => setOrder(e.target.value)} className="border rounded-lg px-3 py-2 bg-white" aria-label="Sort products">
            <option value="created_at.desc">Newest</option>
            <option value="created_at.asc">Oldest</option>
            <option value="price.asc">Price ↑</option>
            <option value="price.desc">Price ↓</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={async () => { await refreshCategories(); setShowCategoriesPanel(true); }} className="px-3 py-2 border rounded-lg hover:bg-slate-50 transition">
            Manage categories
          </button>
          <button onClick={openCreate} className="px-4 py-2 bg-[color:var(--sprada-accent)] text-white rounded-lg shadow hover:shadow-md transition transform active:scale-95">
            Add new
          </button>
          <button onClick={exportCSV} className="px-3 py-2 border rounded-lg hover:bg-slate-50 transition">
            Export CSV
          </button>
        </div>
      </div>

      {message && <div className="text-green-700 mb-3">{message}</div>}
      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: limit }).map((_, i) => <div key={i} className="h-44 bg-gray-100 animate-pulse rounded-2xl" />)
          : products.length === 0
          ? <div className="text-sm text-[color:var(--sprada-muted)]">No products</div>
          : products.map((p) => (
              <article key={p.id} className="bg-white border rounded-2xl p-4 hover:shadow-md transition-transform transform hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="w-28 h-28 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {p.primary_image ? <img src={safeAbsoluteImageUrl(normalizeUploadUrl(p.primary_image))} alt={p.title} className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.src=''}} /> : <div className="text-xs text-[color:var(--sprada-muted)]">No image</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="sprada-heading font-medium text-slate-800 line-clamp-2">{p.title}</h3>
                    <p className="text-xs text-[color:var(--sprada-muted)] mt-1 line-clamp-2">{p.short_description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      {/* category name */}
                      <div className="text-xs text-[color:var(--sprada-muted)]">{p.category?.name || "—"}</div>
                      {/* trade badge */}
                      <TradeBadge trade={p.trade_type || p.effective_trade_type || "both"} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm font-semibold">{p.price ? `${p.currency || "₹"} ${p.price}` : "-"}</div>
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-2 py-1 border rounded hover:bg-slate-50" onClick={() => openEdit(p)}>Edit</button>
                    <button className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50" onClick={() => onDelete(p)}>Delete</button>
                  </div>
                </div>
              </article>
            ))
        }
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 border rounded-lg mr-2">Prev</button>
          <button onClick={() => setPage((p) => p + 1)} className="px-3 py-2 border rounded-lg">Next</button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[color:var(--sprada-muted)]">Per page:</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="border rounded-lg px-3 py-2">
            {[6, 12, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          categories={cats}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async (created) => { setShowForm(false); setEditing(null); await load(); await refreshCategories(); }}
        />
      )}

      {showCategoriesPanel && (
        <CategoriesManager
          initialCategories={cats}
          onClose={async () => { setShowCategoriesPanel(false); await refreshCategories(); }}
          onChange={async () => { await refreshCategories(); await load(); }}
        />
      )}
    </div>
  );
}

/* -------------------------
   ProductForm component
   - polished: error handling, toasts, accessible buttons
   - includes trade_type selection (import/export/both)
   ------------------------- */
function ProductForm({ product = {}, categories = [], onClose, onSaved }) {
  const [form, setForm] = useState({ ...(product || {}) });
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // populate form; ensure trade_type defaults sensibly
    const initial = {
      ...(product || {}),
      trade_type: product.trade_type ?? product.effective_trade_type ?? null,
    };
    setForm(initial);

    (async () => {
      if (product && product.id) {
        try {
          const imgs = await getProductImages(product.id);
          const arr = Array.isArray(imgs) ? imgs : (imgs?.items || imgs?.images || imgs?.data || []);
          setImages((arr || []).map((i) => ({ ...i, url: normalizeUploadUrl(i.url || i.public_url || i.path || i.address || "") })));
        } catch (e) {
          console.warn(e);
          setImages([]);
        }
      } else setImages([]);
    })();
  }, [product]);

  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function save() {
    try {
      setErr("");
      if (!form.title || !String(form.title).trim()) {
        setErr("Title required");
        return;
      }
      setBusy(true);
      let res;
      // normalize image fields before sending
      const payloadPrepared = normalizeBeforeSave({
        ...form,
        trade_type: form.trade_type ?? null,
      });

      if (form.id) res = await apiPut(`/products/${encodeURIComponent(form.id)}`, payloadPrepared);
      else res = await apiPost("/products", payloadPrepared);

      const created = res && (res.product || res.product_id || res.id) ? (res.product || res) : res;
      toast.success("Product saved");
      onSaved && onSaved(created);
    } catch (e) {
      console.error(e);
      setErr("Save failed");
      toast.error("Save failed");
    } finally { setBusy(false); }
  }

  async function onFileSelected(file) {
    if (!file) return;
    if (!form.id) {
      setErr("Save product first to upload images");
      toast.error("Save product first to upload images");
      return;
    }
    setErr(""); setBusy(true);
    const uploadingToastId = toast.loading("Uploading image…");
    try {
      // ensure images upload to the products space so they are served under /uploads/products/...
      const publicUrlRaw = await uploadFile(file, { space: "products" });
      const publicUrl = normalizeUploadUrl(publicUrlRaw || "");
      // create product image record
      const resp = await createProductImage({ product_id: form.id, url: publicUrl, filename: file.name, is_primary: images.length === 0 });
      const created = resp && (resp.image || resp.product_image || (resp.id ? resp : null)) || null;
      if (created) {
        setImages((prev) => [{ ...created, url: normalizeUploadUrl(created.url || created.public_url || publicUrl) }, ...prev]);
      } else {
        setImages((prev) => [{ id: null, url: publicUrl }, ...prev]);
      }
      toast.success("Upload complete", { id: uploadingToastId });
    } catch (e) {
      console.error(e);
      const isMulterLimit = (e && (e.message && /file.*large/i.test(e.message))) ||
                            (e?.status === 400 && e?.data && (e.data.error === "file_too_large" || /file_too_large|LIMIT_FILE_SIZE/.test(JSON.stringify(e.data))));
      if (isMulterLimit) {
        toast.error("Upload failed — file too large. Please use a smaller image.", { id: uploadingToastId });
        setErr("File too large");
      } else {
        toast.error("Upload failed", { id: uploadingToastId });
        setErr("Upload failed");
      }
    } finally { setBusy(false); }
  }

  async function setPrimary(img) {
    if (!img || !img.id) {
      setErr("Cannot set primary for unsaved image");
      toast.error("Cannot set primary for unsaved image");
      return;
    }
    try {
      await patchProductImage(img.id, { is_primary: true });
      const imgs = await getProductImages(form.id);
      const arr = Array.isArray(imgs) ? imgs : (imgs?.items || imgs?.images || imgs?.data || []);
      setImages((arr || []).map((i) => ({ ...i, url: normalizeUploadUrl(i.url || i.public_url || i.path || "") })));
      toast.success("Primary image set");
    } catch (e) {
      console.warn(e);
      setErr("Set primary failed");
      toast.error("Set primary failed");
    }
  }

  async function removeImage(img) {
    if (!confirm("Delete image?")) return;
    try {
      if (img.id) {
        await deleteProductImage(img.id);
        setImages((prev) => prev.filter((i) => i.id !== img.id));
      } else {
        setImages((prev) => prev.filter((i) => i.url !== img.url));
      }
      toast.success("Image deleted");
    } catch (e) {
      console.warn(e);
      setErr("Delete failed");
      toast.error("Delete failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!busy) onClose(); }} />
      <div role="dialog" aria-modal="true" aria-label={form.id ? "Edit Product" : "Create Product"} className="relative bg-white rounded-2xl shadow-lg w-full max-w-3xl p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <div>
              <h3 className="sprada-heading font-semibold text-lg">{form.id ? "Edit Product" : "Create Product"}</h3>
              {form.id && <div className="text-xs text-[color:var(--sprada-muted)]">ID: {String(form.id).slice(0, 8)}</div>}
            </div>
          </div>
          <div>
            <button className="px-3 py-2 border rounded-lg mr-2" onClick={() => { if (!busy) onClose(); }}>Close</button>
            <button className={clsx("px-4 py-2 text-white rounded-lg", busy ? "bg-slate-400" : "bg-[color:var(--sprada-accent)]")} onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {err && <div className="text-red-600 mb-3">{err}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Title</label>
            <input value={form.title || ""} onChange={(e) => setField("title", e.target.value)} className="w-full border rounded-lg px-3 py-2" />

            <label className="block text-xs text-[color:var(--sprada-muted)] mt-3">Slug</label>
            <input value={form.slug || ""} onChange={(e) => setField("slug", e.target.value)} className="w-full border rounded-lg px-3 py-2" />

            <label className="block text-xs text-[color:var(--sprada-muted)] mt-3">Category</label>
            <select value={form.category_id || ""} onChange={(e) => setField("category_id", e.target.value)} className="w-full border rounded-lg px-3 py-2">
              <option value="">-- none --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.trade_type ? `(${c.trade_type})` : ""}</option>)}
            </select>

            <label className="block text-xs text-[color:var(--sprada-muted)] mt-3">Trade type</label>
            <select value={form.trade_type ?? ""} onChange={(e) => setField("trade_type", e.target.value || null)} className="w-full border rounded-lg px-3 py-2">
              <option value="">Inherit from category (or both)</option>
              <option value="import">Import</option>
              <option value="export">Export</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[color:var(--sprada-muted)]">Price</label>
            <div className="flex gap-2">
              <input type="number" value={form.price ?? 0} onChange={(e) => setField("price", e.target.value)} className="w-1/2 border rounded-lg px-3 py-2" />
              <input value={form.currency || "USD"} onChange={(e) => setField("currency", e.target.value)} className="w-1/2 border rounded-lg px-3 py-2" />
            </div>

            <label className="block text-xs text-[color:var(--sprada-muted)] mt-3">Available Qty</label>
            <input type="number" value={form.available_qty ?? 0} onChange={(e) => setField("available_qty", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-[color:var(--sprada-muted)]">Short description</label>
          <textarea value={form.short_description || ""} onChange={(e) => setField("short_description", e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
          <label className="block text-xs text-[color:var(--sprada-muted)] mt-3">Description</label>
          <textarea value={form.description || ""} onChange={(e) => setField("description", e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={4} />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="w-28 h-28 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            {form.og_image ? <img src={safeAbsoluteImageUrl(normalizeUploadUrl(form.og_image))} alt="" className="w-full h-full object-cover" /> : <div className="text-xs text-[color:var(--sprada-muted)]">No image</div>}
          </div>

          <div>
            <label className="px-4 py-2 border rounded-lg cursor-pointer inline-block bg-white">
              Upload image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])} />
            </label>
            <div className="text-xs text-[color:var(--sprada-muted)] mt-2">Uploads try S3 first, then fall back to local server if S3 not configured.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id || img.url} className="border rounded-lg p-2 relative hover:shadow-sm transition">
              <img src={safeAbsoluteImageUrl(normalizeUploadUrl(img.url || img.path || img.public_url || ""))} alt="" className="w-full h-28 object-cover rounded" />
              <div className="flex items-center justify-between mt-2">
                <button onClick={() => setPrimary(img)} className={`text-xs px-2 py-1 border rounded ${img.is_primary ? "bg-[color:var(--sprada-accent)] text-white" : ""}`}>{img.is_primary ? "Primary" : "Set Primary"}</button>
                <button onClick={() => removeImage(img)} className="text-xs px-2 py-1 border rounded text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   CategoriesManager (inline panel)
   - Single-page categories CRUD: create, edit, delete
   - Now supports trade_type field
   ------------------------- */
function CategoriesManager({ initialCategories = [], onClose, onChange }) {
  const [categories, setCategories] = useState(initialCategories || []);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { setCategories(initialCategories?.map(c => ({ ...c, trade_type: c.trade_type || 'both' })) || []); }, [initialCategories]);

  function openNew() {
    setEditing({ name: "", slug: "", description: "", parent_id: "", trade_type: "both" });
    setErr(""); setMsg("");
  }

  function openEdit(cat) {
    setEditing({ ...cat, trade_type: cat.trade_type || "both" });
    setErr(""); setMsg("");
  }

  async function save() {
    try {
      setErr(""); setBusy(true);
      if (!editing || !editing.name || !String(editing.name).trim()) { setErr("Name required"); return; }

      if (editing.id) {
        const payload = {
          name: editing.name,
          slug: editing.slug || undefined,
          description: editing.description || undefined,
          parent_id: editing.parent_id || undefined,
          trade_type: editing.trade_type || "both",
        };
        await apiPut(`/categories/${encodeURIComponent(editing.id)}`, payload);
        const updated = categories.map((c) => c.id === editing.id ? { ...c, ...payload } : c);
        setCategories(updated);
        setMsg("Updated");
        toast.success("Category updated");
      } else {
        const payload = {
          name: editing.name,
          slug: editing.slug || undefined,
          description: editing.description || undefined,
          parent_id: editing.parent_id || undefined,
          trade_type: editing.trade_type || "both",
        };
        const created = await apiPost("/categories", payload);
        // api may return { category } or the created row; handle both
        const createdRow = (created && created.category) ? created.category : created;
        if (createdRow && createdRow.id) setCategories((prev) => [createdRow, ...prev]);
        else {
          // fallback: refresh from server
          try {
            const c = await loadCategoriesWithCounts();
            setCategories(Array.isArray(c) ? c : categories);
          } catch (e) { /* ignore */ }
        }
        setMsg("Created");
        toast.success("Category created");
      }
      setEditing(null);
      if (typeof onChange === "function") onChange();
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      console.error(e);
      setErr("Save failed");
      toast.error("Category save failed");
    } finally { setBusy(false); }
  }

  async function remove(cat) {
    if (!confirm(`Delete category "${cat.name}"? This will NOT delete products but may unset their category.`)) return;
    try {
      setBusy(true);
      await apiDelete(`/categories/${encodeURIComponent(cat.id)}`);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setMsg("Deleted");
      toast.success("Category deleted");
      if (typeof onChange === "function") onChange();
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      console.error(e);
      setErr("Delete failed");
      toast.error("Delete failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!busy) onClose(); }} />
      <div role="dialog" className="relative bg-white rounded-2xl shadow-lg w-full max-w-4xl p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Sprada" className="w-28 object-contain" />
            <h3 className="sprada-heading font-semibold text-lg">Manage Categories</h3>
          </div>
          <div>
            <button className="px-3 py-2 border rounded-lg mr-2" onClick={() => { if (!busy) onClose(); }}>Close</button>
            <button className="px-4 py-2 bg-[color:var(--sprada-accent)] text-white rounded-lg" onClick={openNew}>New Category</button>
          </div>
        </div>

        {err && <div className="text-red-600 mb-3">{err}</div>}
        {msg && <div className="text-green-700 mb-3">{msg}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3 max-h-[56vh] overflow-auto pr-2">
            {categories.length === 0 && <div className="text-sm text-[color:var(--sprada-muted)]">No categories</div>}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition">
                <div>
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-xs text-[color:var(--sprada-muted)]">{cat.slug} {cat.product_count !== undefined ? `• ${cat.product_count} products` : ""} • {cat.trade_type || "both"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 border rounded text-sm" onClick={() => openEdit(cat)}>Edit</button>
                  <button className="px-3 py-1 border rounded text-sm text-red-600" onClick={() => remove(cat)}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-3">{editing ? (editing.id ? "Edit Category" : "Create Category") : "Select or create"}</h4>

            <div className="space-y-3">
              <label className="block text-xs text-[color:var(--sprada-muted)]">Name</label>
              <input value={editing?.name || ""} onChange={(e) => setEditing((prev) => ({ ...(prev || {}), name: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />

              <label className="block text-xs text-[color:var(--sprada-muted)] mt-2">Slug</label>
              <input value={editing?.slug || ""} onChange={(e) => setEditing((prev) => ({ ...(prev || {}), slug: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />

              <label className="block text-xs text-[color:var(--sprada-muted)] mt-2">Parent</label>
              <select value={editing?.parent_id || ""} onChange={(e) => setEditing((prev) => ({ ...(prev || {}), parent_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                <option value="">-- none --</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <label className="block text-xs text-[color:var(--sprada-muted)] mt-2">Trade type</label>
              <select value={editing?.trade_type || "both"} onChange={(e) => setEditing((prev) => ({ ...(prev || {}), trade_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                <option value="import">Import</option>
                <option value="export">Export</option>
                <option value="both">Both</option>
              </select>

              <label className="block text-xs text-[color:var(--sprada-muted)] mt-2">Description</label>
              <textarea value={editing?.description || ""} onChange={(e) => setEditing((prev) => ({ ...(prev || {}), description: e.target.value }))} className="w-full border rounded-lg px-3 py-2" rows={4} />

              <div className="mt-4 flex items-center justify-between">
                <div>{editing && editing.id && <button className="px-3 py-2 border rounded-lg mr-2" onClick={() => setEditing(null)}>Cancel</button>}</div>
                <div><button className={clsx("px-4 py-2 rounded-lg text-white", busy ? "bg-slate-400" : "bg-[color:var(--sprada-accent)]")} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

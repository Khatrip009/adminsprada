// src/lib/api.js
// Robust frontend API helper with automatic token refresh + normalization.
// Space-aware uploads: POST to /api/uploads/<space> and serve files from /uploads/<space>/...

/* -----------------------
   Config / constants
   ----------------------- */
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "http://localhost:4200").replace(/\/$/, "");
export const API_BASE = `${API_ORIGIN}/api`;
export const UPLOAD_STRATEGY = (import.meta.env.VITE_UPLOAD_STRATEGY || "local").toLowerCase();
// Serveable uploads base (used for building image URLs)
export const UPLOADS_BASE = `${API_ORIGIN.replace(/\/$/, "")}/uploads`;

/* -----------------------
   Auth helpers
   ----------------------- */
function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tryParseJSON(response) {
  // return parsed json if possible, otherwise raw text or null
  if (!response) return null;
  try {
    const txt = await response.text();
    try {
      return txt ? JSON.parse(txt) : null;
    } catch {
      return txt || null;
    }
  } catch (err) {
    return null;
  }
}

/* -----------------------
   Centralized logout helper
   - Removes tokens/user from localStorage
   - Dispatches a global "app:logout" event so UI can listen and react
   ----------------------- */
export function logout() {
  try { localStorage.removeItem("accessToken"); } catch (_) {}
  try { localStorage.removeItem("refreshToken"); } catch (_) {}
  try { localStorage.removeItem("user"); } catch (_) {}

  // Dispatch an event so UI / stores can react (redirect, show toast, clear redux)
  try {
    window.dispatchEvent(new CustomEvent("app:logout"));
  } catch (_) {}
}

/* -----------------------
   Token refresh helpers
   ----------------------- */
export async function attemptRefresh() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      // remove local tokens if refresh endpoint explicitly failed
      try { localStorage.removeItem("accessToken"); } catch (_) {}
      try { localStorage.removeItem("refreshToken"); } catch (_) {}
      try { localStorage.removeItem("user"); } catch (_) {}
      return false;
    }

    const data = await tryParseJSON(res);
    const accessToken = data?.accessToken || data?.access_token || data?.token || null;
    const refresh = data?.refreshToken || data?.refresh_token || data?.refresh || null;
    const user = data?.user || data?.userInfo || null;

    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refresh) localStorage.setItem("refreshToken", refresh);
    if (user) localStorage.setItem("user", JSON.stringify(user));

    return !!accessToken;
  } catch (err) {
    console.warn("[api] refresh failed", err);
    try { localStorage.removeItem("accessToken"); } catch (_) {}
    try { localStorage.removeItem("refreshToken"); } catch (_) {}
    try { localStorage.removeItem("user"); } catch (_) {}
    return false;
  }
}

/* -----------------------
   Utility: make relative/partial urls absolute (improved)
   - If url is already absolute, returned unchanged.
   - If url starts with /uploads or /src/uploads, prefix with API_ORIGIN.
   - If url is uploads/... or src/uploads/... or a bare filename, prefix with UPLOADS_BASE.
   ----------------------- */
export function toAbsoluteImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already absolute
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Starts with /uploads or /src/uploads
  if (/^\/(?:src\/)?uploads\//i.test(trimmed)) {
    return `${API_ORIGIN}${trimmed}`;
  }

  // Relative uploads path like uploads/foo.jpg or src/uploads/...
  if (/^(?:src\/)?uploads\//i.test(trimmed)) {
    return `${API_ORIGIN}/${trimmed.replace(/^\/+/, "")}`;
  }

  // Bare filename or path -> assume uploads base (space)
  if (!trimmed.startsWith("/")) {
    return `${UPLOADS_BASE.replace(/\/$/, "")}/${trimmed.replace(/^\/+/, "")}`;
  }

  // Fallback: prefix API_ORIGIN
  return `${API_ORIGIN}${trimmed}`;
}

/* -----------------------
   Core fetch wrapper (improved)
   - Normalizes path slashes
   - Supports optional timeoutMs in opts (non-breaking)
   - Calls logout() when refresh fails and tokens removed
   ----------------------- */
async function apiFetch(path, opts = {}, { _retrying = false } = {}) {
  // normalize path: allow absolute URL or relative paths with or without leading slash
  let url;
  if (/^https?:\/\//i.test(path)) {
    url = path;
  } else {
    const p = path && typeof path === "string" ? (path.startsWith("/") ? path : `/${path}`) : "/";
    url = `${API_BASE}${p}`;
  }

  // timeout helper (optional)
  const timeoutMs = (opts && typeof opts.timeoutMs === "number") ? opts.timeoutMs : 0;
  let controller;
  let timeoutId;
  if (timeoutMs > 0) {
    controller = new AbortController();
    // ensure we don't clobber existing signal if passed
    if (!opts.signal) opts.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    // Default headers; respect caller-provided opts.headers and always ensure auth header appended
    // If opts.headers is a Headers instance we try to convert it to plain object for checks below
    let incomingHeaders = opts.headers || {};
    if (incomingHeaders instanceof Headers) {
      const obj = {};
      for (const [k, v] of incomingHeaders.entries()) obj[k] = v;
      incomingHeaders = obj;
    }

    const headers = { "Content-Type": "application/json", ...(incomingHeaders || {}), ...authHeaders() };

    // If caller explicitly provided multipart marker, remove Content-Type so browser sets boundary
    const callerCT = (incomingHeaders && (incomingHeaders['Content-Type'] || incomingHeaders['content-type']));
    if (callerCT && /multipart\/form-data/i.test(String(callerCT))) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }

    const res = await fetch(url, {
      ...opts,
      headers,
      credentials: "include"
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (res.status === 204) return null;
    const data = await tryParseJSON(res);

    if (!res.ok) {
      // 401 -> try token refresh once
      if (res.status === 401 && !_retrying) {
        const refreshed = await attemptRefresh();
        if (refreshed) return apiFetch(path, opts, { _retrying: true });
        // Token refresh failed: clear tokens + notify app
        logout();
        const err = new Error("unauthorized");
        err.status = 401;
        err.data = data;
        throw err;
      }

      const err = new Error((data && (data.error || data.message)) || res.statusText || "API error");
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err?.name === "AbortError") {
      const abortErr = new Error("request_timeout");
      abortErr.status = 0;
      throw abortErr;
    }

    // More helpful logs for debugging; avoid noisy logs for expected 4xx handled upstream
    if (!err || !err.status || err.status >= 500) {
      console.error("[apiFetch] ERROR", url, err);
    } else {
      console.debug("[apiFetch] handled", url, err && err.status ? `status=${err.status}` : err);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/* Basic helpers */
export async function apiGet(path, opts = {}) { return apiFetch(path, { method: "GET", ...opts }); }
export async function apiPost(path, body, opts = {}) {
  const isForm = body instanceof FormData;
  const bodyStr = isForm ? body : JSON.stringify(body);
  const headers = isForm ? (opts.headers || {}) : { "Content-Type": "application/json", ...(opts.headers || {}) };
  return apiFetch(path, { method: "POST", body: bodyStr, headers, ...opts });
}
export async function apiPut(path, body, opts = {}) {
  const isForm = body instanceof FormData;
  const bodyStr = isForm ? body : JSON.stringify(body);
  const headers = isForm ? (opts.headers || {}) : { "Content-Type": "application/json", ...(opts.headers || {}) };
  return apiFetch(path, { method: "PUT", body: bodyStr, headers, ...opts });
}
export async function apiDelete(path, opts = {}) { return apiFetch(path, { method: "DELETE", ...opts }); }

/* -----------------------
   Auth
   ----------------------- */
export async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).catch(err => { throw err; });

  const accessToken = data?.accessToken || data?.access_token || data?.token || data?.access || null;
  const refreshToken = data?.refreshToken || data?.refresh_token || data?.refresh || null;
  const user = data?.user || data?.userInfo || data?.profile || null;

  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  if (user) localStorage.setItem("user", JSON.stringify(user));

  return { accessToken, refreshToken, user, raw: data };
}

/* Metrics & lists */
export const getVisitorSummary = () => apiGet("/metrics/visitors/summary");
export const getReviewsStats = () => apiGet("/reviews/stats");
export const getRecentReviews = () => apiGet("/reviews");
export const getCategories = () => apiGet("/categories?include_counts=true");
export const getHomeData = () => apiGet("/home");
export const getVisitorsList = () => apiGet("/visitors/list");
export const getPushList = () => apiGet("/push/list");
export const getPushSubscriptions = () => getPushList();

/* -------- Products helpers -------- */
export async function getProducts(arg = 20) {
  if (typeof arg === "number") return apiGet(`/products?limit=${arg}`);
  const opts = arg || {};
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.q) qs.set("q", opts.q);
  if (opts.category_id) qs.set("category_id", opts.category_id);
  if (opts.category_slug) qs.set("category_slug", opts.category_slug);
  if (opts.order) qs.set("order", opts.order);
  if (opts.trade_type) qs.set("trade_type", opts.trade_type);
  return apiGet(`/products?${qs.toString()}`);
}
export const getRecentProducts = (limit = 8) => getProducts(limit);

/* -------- Blogs helpers -------- */
/* -------- Blogs helpers (defensive) -------- */
// Original (simple): export const getBlogs = (limit = 10) => apiGet(`/blogs?limit=${limit}`);
// Replace with defensive version that logs raw response data on failure
export async function getBlogs(limit = 10) {
  const path = `/blogs?limit=${encodeURIComponent(limit)}`;
  try {
    const data = await apiGet(path);
    // Normalize shapes: return array when the endpoint returns { blogs: [...] } or array directly
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.blogs && Array.isArray(data.blogs)) return data.blogs;
    // maybe server returns { ok: true, data: { blogs: [...] } }
    if (data.data && Array.isArray(data.data.blogs)) return data.data.blogs;
    // Single object -> wrap
    if (data.id || data.title) return [data];
    // fallback: return empty and log
    console.warn("[api.getBlogs] unexpected response shape:", data);
    return [];
  } catch (err) {
    // err.data may contain raw text (HTML error page) — log it for debugging
    console.error("[api.getBlogs] failed to fetch blogs:", err);
    if (err && err.data) {
      console.debug("[api.getBlogs] raw response data:", err.data);
    }
    // return empty list so UI degrades gracefully
    return [];
  }
}

export const getRecentBlogs = (limit = 6) => getBlogs(limit);

export async function getBlogFlexible(blogId) {
  if (!blogId) throw new Error("blogId required");
  // Primary attempt: direct GET by id/slug
  const attempts = [
    `/blogs/${encodeURIComponent(blogId)}`,
    `/blogs/slug/${encodeURIComponent(blogId)}`,
    `/blogs/id/${encodeURIComponent(blogId)}`,
    `/blogs?blogId=${encodeURIComponent(blogId)}`,
    `/blogs?id=${encodeURIComponent(blogId)}`
  ];

  let lastErr = null;
  for (const path of attempts) {
    try {
      const res = await apiGet(path);
      if (!res) continue;
      // server might return { ok: true, blog: {...} } or plain blog object
      if (res.ok && res.blog) return res.blog;
      if (res.blog) return res.blog;
      if (res.id || res.title) return res;
      if (res.data && (res.data.blog || res.data)) return res.data.blog || res.data;
    } catch (err) {
      lastErr = err;
      if (err?.status === 404 || err?.message === "not_found") continue;
      continue;
    }
  }
  if (lastErr) throw lastErr;
  const nf = new Error("not_found");
  nf.status = 404;
  throw nf;
}

/* Create blog (ADMIN) */
export async function createBlog(payload) {
  if (!payload || !payload.title || !payload.content) throw new Error('title and content required');
  return apiPost('/blogs', payload);
}

/* Update blog (ADMIN) */
export async function updateBlog(id, payload) {
  if (!id) throw new Error('id required');
  if (!payload || Object.keys(payload).length === 0) throw new Error('no update fields');
  return apiPut(`/blogs/${encodeURIComponent(id)}`, payload);
}

/* Delete blog (ADMIN) */
export async function deleteBlog(id) {
  if (!id) throw new Error('id required');
  return apiDelete(`/blogs/${encodeURIComponent(id)}`);
}

/* Publish / unpublish blog (ADMIN) */
export async function publishBlog(id, { publish = true, published_at = null } = {}) {
  if (!id) throw new Error('id required');
  const payload = { publish };
  if (published_at) payload.published_at = published_at;
  return apiPost(`/blogs/${encodeURIComponent(id)}/publish`, payload);
}

/* Editor single file upload (ADMIN) - posts to /api/blogs/upload (multipart) */
export async function uploadBlogEditorFile(file) {
  if (!(file instanceof File)) throw new Error('file required');
  const url = `${API_BASE}/blogs/upload`;
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: fd,
    headers: { ...authHeaders() } // do not set Content-Type manually
  });

  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'upload_error');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // server returns { ok: true, image: {...} } or { url: "/uploads/..." } or { filename: "..." }
  let publicUrl = data?.data?.url || data?.url || data?.data?.publicUrl || data?.publicUrl || data?.path || data?.image?.url || data?.image?.publicUrl || data?.image?.path || null;

  if (!publicUrl && data?.filename) publicUrl = `/uploads/blogs/${encodeURIComponent(data.filename)}`;

  if (typeof publicUrl === 'string' && publicUrl.startsWith('/')) {
    publicUrl = `${API_ORIGIN}${publicUrl}`;
  } else if (typeof publicUrl === 'string' && !/^https?:\/\//i.test(publicUrl)) {
    // bare relative path
    publicUrl = `${API_ORIGIN}/${publicUrl.replace(/^\/+/, "")}`;
  }

  return publicUrl || data;
}

/* -----------------------
   Upload helpers (space-aware)
   ----------------------- */

/**
 * presignUpload(fileName, fileType)
 * Only attempts presign when UPLOAD_STRATEGY === 's3'
 */
export async function presignUpload(fileName, fileType) {
  if (UPLOAD_STRATEGY === 's3') {
    return apiPost("/uploads/presign", { fileName, fileType });
  }
  return null;
}

/**
 * uploadFileToLocalSpace(file, space = 'blogs')
 * Posts multipart FormData to /api/uploads/<space>
 * Returns normalized public URL string (or throws).
 */
export async function uploadFileToLocalSpace(file, space = 'blogs') {
  if (!(file instanceof File)) throw new Error('file required');
  if (!space) space = 'blogs';
  const url = `${API_BASE}/uploads/${encodeURIComponent(space)}`;
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: fd,
    headers: { ...authHeaders() } // do not set Content-Type manually for multipart
  });

  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'upload_error');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Normalize response: prefer publicUrl/public_url/url then fallback to filename -> build url using space
  let publicUrl = data?.publicUrl || data?.public_url || data?.url || data?.path || null;
  if (publicUrl && typeof publicUrl === 'string') {
    if (publicUrl.startsWith('/')) return `${API_ORIGIN}${publicUrl}`;
    if (!/^https?:\/\//i.test(publicUrl)) return `${API_ORIGIN}/${publicUrl.replace(/^\/+/, "")}`;
    return publicUrl;
  }

  if (data?.filename) {
    // In development return relative path so Vite proxy handles it; in production use API_ORIGIN.
    if (import.meta.env.MODE !== 'production') {
      return `/uploads/${encodeURIComponent(space)}/${encodeURIComponent(data.filename)}`;
    }
    return `${API_ORIGIN}/uploads/${encodeURIComponent(space)}/${encodeURIComponent(data.filename)}`;
  }

  return data;
}

/**
 * uploadFile(file, options)
 * - options.space: 'blogs' | 'products' (defaults to 'blogs')
 * Attempts S3 presign flow if configured, otherwise falls back to local space upload.
 */
export async function uploadFile(file, { space = 'blogs' } = {}) {
  if (!(file instanceof File)) throw new Error('file required');

  if (UPLOAD_STRATEGY === 's3') {
    try {
      const pres = await presignUpload(file.name, file.type || 'application/octet-stream');
      if (pres && pres.uploadUrl) {
        const putRes = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!putRes.ok) {
          console.warn('[uploadFile] presign PUT failed, falling back to local', putRes.status);
          return await uploadFileToLocalSpace(file, space);
        }
        return pres.publicUrl || pres.public_url || pres.url;
      }
      return await uploadFileToLocalSpace(file, space);
    } catch (err) {
      console.warn('[uploadFile] presign failed, falling back to local upload', err && err.message ? err.message : err);
      return uploadFileToLocalSpace(file, space);
    }
  }

  // Default: local upload (space-aware)
  return uploadFileToLocalSpace(file, space);
}

/* -------- Product images gallery helpers -------- */
export async function createProductImage(payload) {
  const headers = { "Content-Type": "application/json", ...authHeaders() };
  const url = `${API_BASE}/product-images`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "API error");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function getProductImages(product_id) {
  if (!product_id) throw new Error('product_id required');
  return apiGet(`/product-images?product_id=${encodeURIComponent(product_id)}`);
}
export async function deleteProductImage(id) { if (!id) throw new Error('id required'); return apiDelete(`/product-images/${encodeURIComponent(id)}`); }
export async function patchProductImage(id, patchObj) {
  if (!id) throw new Error('id required');
  const url = `${API_BASE}/product-images/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(patchObj)
  });
  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'API error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* -------- Blog images helpers -------- */

export async function attachBlogImage(blogId, url, caption = null) {
  if (!blogId) throw new Error('blogId required');
  if (!url) throw new Error('url required');

  const payload = { blog_id: blogId, url, caption };
  const res = await fetch(`${API_BASE}/blog-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'API error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function uploadAndAttachBlogImage(file, blogId, caption = null) {
  if (!(file instanceof File)) throw new Error('file required');
  if (!blogId) throw new Error('blogId required');

  // 1) upload to 'blogs' space
  const publicUrl = await uploadFile(file, { space: 'blogs' });

  // 2) attach record
  const created = await attachBlogImage(blogId, publicUrl, caption);
  return { uploadUrl: publicUrl, db: created };
}

export async function getBlogImages(blog_id) {
  if (!blog_id) throw new Error('blog_id required');
  return apiGet(`/blog-images?blog_id=${encodeURIComponent(blog_id)}`);
}
export async function deleteBlogImage(id) { if (!id) throw new Error('id required'); return apiDelete(`/blog-images/${encodeURIComponent(id)}`); }

/* -------- Blog comments -------- */

export async function postComment(blogId, payload = {}) {
  if (!blogId) throw new Error('blogId required');
  if (!payload || !payload.body) throw new Error('body required');
  const res = await fetch(`${API_BASE}/blogs/${encodeURIComponent(blogId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  const data = await tryParseJSON(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'API error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function getComments(blogId, { all = false } = {}) {
  if (!blogId) throw new Error('blogId required');
  const url = `/blogs/${encodeURIComponent(blogId)}/comments${all ? '?all=true' : ''}`;
  return apiGet(url);
}

export async function updateComment(commentId, payload = {}) {
  if (!commentId) throw new Error('commentId required');
  if (!payload || Object.keys(payload).length === 0) throw new Error('no update fields');
  return apiPut(`/blogs/comments/${encodeURIComponent(commentId)}`, payload);
}

export async function deleteComment(commentId) {
  if (!commentId) throw new Error('commentId required');
  return apiDelete(`/blogs/comments/${encodeURIComponent(commentId)}`);
}

/* -------- Blog likes -------- */

export async function toggleLike(blogId, { user_id = undefined } = {}) {
  if (!blogId) throw new Error('blogId required');
  const payload = {};
  if (user_id) payload.user_id = user_id;
  return apiPost(`/blogs/${encodeURIComponent(blogId)}/like`, payload);
}

export async function getLikesCount(blogId) {
  if (!blogId) throw new Error('blogId required');
  return apiGet(`/blogs/${encodeURIComponent(blogId)}/count`);
}

/* -------- Robust wrapper for visitor sessions used by some components -------- */
export async function getVisitorSessions() {
  try {
    return await getVisitorsList();
  } catch (err) {
    if (err?.status === 404) {
      console.warn("[API] visitors/list not found — returning empty array as fallback");
      return [];
    }
    throw err;
  }
}
// add somewhere near the other leads helpers (e.g. after getLeads/getLeadById)
export async function getLeadsStats() {
  // Returns aggregated statistics for dashboard metric card:
  // { total, today, week, month, conversion_rate, ... }
  return apiGet("/leads-stats/stats");
}

/* Default export convenience object */
export default {
  API_ORIGIN, API_BASE, UPLOADS_BASE, UPLOAD_STRATEGY,
  apiGet, apiPost, apiPut, apiDelete, login,
  getVisitorSummary, getReviewsStats, getRecentReviews,
  getCategories, getProducts, getBlogs, getHomeData,
  getVisitorsList, getPushList, getPushSubscriptions,
  getRecentProducts, getRecentBlogs, getVisitorSessions,
  presignUpload, uploadFileToLocalSpace, uploadFile,
  createProductImage, getProductImages, deleteProductImage, patchProductImage,
  attachBlogImage, uploadAndAttachBlogImage, getBlogImages, deleteBlogImage,
  createBlog, updateBlog, deleteBlog, publishBlog, uploadBlogEditorFile,
  postComment, getComments, updateComment, deleteComment,
  toggleLike, getLikesCount, toAbsoluteImageUrl, getBlogFlexible,
  attemptRefresh, logout
};

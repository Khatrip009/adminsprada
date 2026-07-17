// src/lib/api.js – Supabase‑only with all dashboard functions
import { supabase } from './supabaseClient';
import auth from './auth';

export const API_ORIGIN = '';
export const API_BASE = '';
export const UPLOAD_STRATEGY = 's3';

// -------------------------------------------------------------
// 2. Auth – using Supabase Auth
// -------------------------------------------------------------
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { user, session } = data;
  const accessToken = session?.access_token;
  const refreshToken = session?.refresh_token;
  await auth.loginWithTokens({ accessToken, refreshToken, user });
  return { accessToken, refreshToken, user, raw: data };
}

export async function logout() {
  await supabase.auth.signOut();
  await auth.logout();
}

export async function attemptRefresh() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return false;
  const session = data.session;
  if (session) {
    await auth.loginWithTokens({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: session.user,
    });
    return true;
  }
  return false;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
}

// -------------------------------------------------------------
// 3. Generic query helper
// -------------------------------------------------------------
async function supabaseQuery(table, select = '*', filters = {}, options = {}) {
  let query = supabase.from(table).select(select);
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object' && value !== null) {
      const { column, operator, value: val } = value;
      query = query.filter(column, operator, val);
    } else {
      query = query.eq(key, value);
    }
  });
  if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending });
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// -------------------------------------------------------------
// 4. All API functions
// -------------------------------------------------------------

// -------- Products --------
export async function getProducts(arg = 20) {
  let filters = {};
  let options = { limit: 20 };
  if (typeof arg === 'number') {
    options.limit = arg;
  } else if (typeof arg === 'object') {
    if (arg.limit) options.limit = arg.limit;
    if (arg.page) options.offset = (arg.page - 1) * (arg.limit || 20);
    if (arg.category_id) filters.category_id = arg.category_id;
    if (arg.category_slug) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', arg.category_slug)
        .single();
      if (cat) filters.category_id = cat.id;
      else return [];
    }
    if (arg.trade_type) filters.trade_type = arg.trade_type;
    if (arg.q) {
      const search = `%${arg.q}%`;
      filters.title = { column: 'title', operator: 'ilike', value: search };
    }
    if (arg.order) {
      // 🔧 Fix: parse both dot‑separated and space‑separated orders
      let column, dir;
      if (arg.order.includes(' ')) {
        [column, dir] = arg.order.split(' ');
      } else if (arg.order.includes('.')) {
        [column, dir] = arg.order.split('.');
      } else {
        column = arg.order;
        dir = 'asc';
      }
      options.order = { column, ascending: dir === 'asc' };
    }
  }

  // Build the query with image join
  let query = supabase
    .from('products')
    .select(`
      *,
      product_images ( id, url, is_primary )
    `);

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object' && value !== null) {
      const { column, operator, value: val } = value;
      query = query.filter(column, operator, val);
    } else {
      query = query.eq(key, value);
    }
  });

  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending });
  }
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

  const { data, error } = await query;
  if (error) throw error;

  // Transform to add primary_image field
  return (data || []).map(product => {
    const primaryImg = product.product_images?.find(img => img.is_primary) || product.product_images?.[0];
    return {
      ...product,
      primary_image: primaryImg?.url || null,
    };
  });
}

// ✅ Added missing functions
export const getRecentProducts = (limit = 8) => getProducts({ limit });

export async function getProductCount() {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

// -------- Categories --------
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

// -------- Blogs --------
export async function getBlogs(limit = 10) {
  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
export const getRecentBlogs = (limit = 6) => getBlogs(limit);

export async function getBlogFlexible(blogId) {
  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .or(`id.eq.${blogId},slug.eq.${blogId}`)
    .single();
  if (error) {
    const { data: data2, error: error2 } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single();
    if (error2) {
      const nf = new Error('not_found');
      nf.status = 404;
      throw nf;
    }
    return data2;
  }
  return data;
}

export async function createBlog(payload) {
  const { data, error } = await supabase
    .from('blogs')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function updateBlog(id, payload) {
  const { data, error } = await supabase
    .from('blogs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function deleteBlog(id) {
  const { error } = await supabase.from('blogs').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}
export async function publishBlog(id, { publish = true, published_at = null } = {}) {
  const payload = { is_published: publish };
  if (published_at) payload.published_at = published_at;
  return updateBlog(id, payload);
}

// -------- Blog images --------
export async function uploadBlogEditorFile(file) {
  const filePath = `blogs/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('sprada_storage').upload(filePath, file);
  if (error) throw error;
  const { data } = supabase.storage.from('sprada_storage').getPublicUrl(filePath);
  return data.publicUrl;
}
export async function attachBlogImage(blogId, url, caption = null) {
  const { data, error } = await supabase
    .from('blog_images')
    .insert({ blog_id: blogId, url, caption })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function uploadAndAttachBlogImage(file, blogId, caption = null) {
  const url = await uploadBlogEditorFile(file);
  const created = await attachBlogImage(blogId, url, caption);
  return { uploadUrl: url, db: created };
}
export async function getBlogImages(blog_id) {
  const { data, error } = await supabase
    .from('blog_images')
    .select('*')
    .eq('blog_id', blog_id);
  if (error) throw error;
  return data;
}
export async function deleteBlogImage(id) {
  const { error } = await supabase.from('blog_images').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// -------- Product images --------
export async function createProductImage(productId, file, isPrimary = false) {
  const filePath = `products/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('sprada_storage').upload(filePath, file);
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from('sprada_storage').getPublicUrl(filePath);
  const { data, error: dbError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      url: publicUrl.publicUrl,
      is_primary: isPrimary,
      filename: file.name,
    })
    .select()
    .single();
  if (dbError) throw dbError;
  return data;
}
export async function getProductImages(product_id) {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', product_id);
  if (error) throw error;
  return data;
}
export async function deleteProductImage(id) {
  const { error } = await supabase.from('product_images').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}
export async function patchProductImage(id, patchObj) {
  const { data, error } = await supabase
    .from('product_images')
    .update(patchObj)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// -------- Reviews --------
export async function getReviewsStats() {
  const { count, error: countErr } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  const { data: avgData, error: avgErr } = await supabase
    .from('reviews')
    .select('rating')
    .not('rating', 'is', null);
  if (avgErr) throw avgErr;
  let avg = 0;
  if (avgData && avgData.length > 0) {
    const sum = avgData.reduce((acc, r) => acc + r.rating, 0);
    avg = sum / avgData.length;
  }
  return { total: count || 0, average: avg };
}
export async function getRecentReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data;
}

// -------- Leads --------
export async function getLeads(limit = 10) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
export async function getLeadsStats() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { count: total, error: totalErr } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  if (totalErr) throw totalErr;
  const { count: todayCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);
  const { count: weekCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo);
  const { count: monthCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', monthAgo);
  return {
    total: total || 0,
    today: todayCount || 0,
    week: weekCount || 0,
    month: monthCount || 0,
  };
}

// -------- Visitors --------
export async function getVisitorSummary() {
  const today = new Date().toISOString().split('T')[0];
  const { count: total, error: totalErr } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true });
  if (totalErr) throw totalErr;
  const { count: todayCount, error: todayErr } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen', today);
  if (todayErr) throw todayErr;
  return { total: total || 0, today: todayCount || 0 };
}
export async function getVisitorsList() {
  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .order('last_seen', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}
export const getVisitorSessions = getVisitorsList;

// -------- Push Subscriptions --------
export async function getPushList() {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export const getPushSubscriptions = getPushList;

// -------- Home data --------
export async function getHomeData() {
  const [products, blogs, categories] = await Promise.all([
    getProducts({ limit: 6 }),
    getBlogs(3),
    getCategories(),
  ]);
  return { products, blogs, categories };
}

// -------- Image helper --------
export function toAbsoluteImageUrl(path) {
  if (!path) return null;
  if (path.includes('/storage/v1/object/public/sprada_storage')) return path;
  if (path.startsWith('data:')) return path;

  let cleanPath = path;
  if (/^https?:\/\//i.test(cleanPath)) {
    const parts = cleanPath.split('/uploads/');
    if (parts.length > 1) {
      cleanPath = parts.slice(1).join('/uploads/');
    } else {
      return null;
    }
  } else {
    cleanPath = cleanPath.replace(/^\/+/, '');
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring('uploads/'.length);
    }
  }

  const { data } = supabase.storage.from('sprada_storage').getPublicUrl(cleanPath);
  return data.publicUrl;
}

// -------- Upload --------
export async function uploadFile(file, { space = "blogs" } = {}) {
  const filePath = `${space}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('sprada_storage').upload(filePath, file);
  if (error) throw error;
  return filePath;
}
export const presignUpload = () => null;
export const uploadFileToLocalSpace = () => { throw new Error('Use uploadFile with Supabase'); };

// -------- Blog comments --------
export async function postComment(blogId, payload) {
  const { data, error } = await supabase
    .from('blog_comments')
    .insert({ blog_id: blogId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function getComments(blogId, { all = false } = {}) {
  let query = supabase.from('blog_comments').select('*').eq('blog_id', blogId);
  if (!all) query = query.eq('is_approved', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function updateComment(commentId, payload) {
  const { data, error } = await supabase
    .from('blog_comments')
    .update(payload)
    .eq('id', commentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function deleteComment(commentId) {
  const { error } = await supabase.from('blog_comments').delete().eq('id', commentId);
  if (error) throw error;
  return { success: true };
}

// -------- Blog likes --------
export async function toggleLike(blogId, { user_id } = {}) {
  const { data: existing } = await supabase
    .from('blog_likes')
    .select('*')
    .eq('blog_id', blogId)
    .eq('user_id', user_id)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from('blog_likes').delete().eq('blog_id', blogId).eq('user_id', user_id);
    if (error) throw error;
    return { liked: false };
  } else {
    const { error } = await supabase.from('blog_likes').insert({ blog_id: blogId, user_id });
    if (error) throw error;
    return { liked: true };
  }
}
export async function getLikesCount(blogId) {
  const { count, error } = await supabase
    .from('blog_likes')
    .select('*', { count: 'exact', head: true })
    .eq('blog_id', blogId);
  if (error) throw error;
  return { count };
}

// -------- Leads (extended) --------
export async function getLeadById(id) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
export async function getLeadNotes(leadId) {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('lead_notes table not found or error, returning empty notes', error);
    return [];
  }
  return data;
}
export async function addLeadNote(leadId, { note }) {
  const { data: userData } = await supabase.auth.getUser();
  const author = userData?.user?.email || 'admin';
  const { data, error } = await supabase
    .from('lead_notes')
    .insert({
      lead_id: leadId,
      note: note,
      author,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function updateLead(id, payload) {
  const { data, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// -------- Compatibility stubs --------
export function apiGet() {
  throw new Error('apiGet is not supported in Supabase mode. Please use the specific functions like getProducts(), getBlogs(), etc.');
}
export function apiPost() {
  throw new Error('apiPost is not supported. Use specific functions like createBlog(), postComment(), etc.');
}
export function apiPut() {
  throw new Error('apiPut is not supported. Use specific functions like updateBlog(), updateComment(), etc.');
}
export function apiDelete() {
  throw new Error('apiDelete is not supported. Use specific functions like deleteBlog(), deleteComment(), etc.');
}

// -------------------------------------------------------------
// 5. Default export
// -------------------------------------------------------------
export default {
  login,
  logout,
  attemptRefresh,
  getUser,
  getAccessToken,
  getProducts,
  getRecentProducts,
  getProductCount,
  getCategories,
  getBlogs,
  getRecentBlogs,
  getBlogFlexible,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
  uploadBlogEditorFile,
  attachBlogImage,
  uploadAndAttachBlogImage,
  getBlogImages,
  deleteBlogImage,
  createProductImage,
  getProductImages,
  deleteProductImage,
  patchProductImage,
  getReviewsStats,
  getRecentReviews,
  getVisitorSummary,
  getVisitorsList,
  getVisitorSessions,
  getPushList,
  getPushSubscriptions,
  getHomeData,
  getLeads,
  getLeadsStats,
  toAbsoluteImageUrl,
  uploadFile,
  presignUpload,
  uploadFileToLocalSpace,
  postComment,
  getComments,
  updateComment,
  deleteComment,
  toggleLike,
  getLikesCount,
  getLeadById,
  getLeadNotes,
  addLeadNote,
  updateLead,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
};

// ✅ Expose the Supabase client for direct queries
export { supabase };
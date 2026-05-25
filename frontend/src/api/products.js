import { api, ApiError } from './client.js';

const BASE = '/api/v1';

// Sube una imagen de producto (multipart) y devuelve { image_url }.
async function uploadImage(token, file) {
  const fd = new FormData();
  fd.append('image', file);

  const res = await fetch(`${BASE}/admin/products/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText, data?.details);
  return data;
}

export const productsApi = {
  // Storefront publico
  listPublic: (slug)        => api.get(`/t/${slug}/products`),
  getPublic:  (slug, id)    => api.get(`/t/${slug}/products/${id}`),

  // Admin (requiere token)
  listAdmin:  (token)            => api.get('/admin/products', { token }),
  create:     (token, payload)   => api.post('/admin/products', payload, { token }),
  update:     (token, id, patch) => api.patch(`/admin/products/${id}`, patch, { token }),
  remove:     (token, id)        => api.delete(`/admin/products/${id}`, { token }),
  uploadImage,
};

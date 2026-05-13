import { api, ApiError } from './client.js';

const BASE = '/api/v1';

async function uploadImage(token, file) {
  const fd = new FormData();
  fd.append('image', file);

  const res = await fetch(`${BASE}/admin/tenant/image`, {
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

export const tenantApi = {
  get:         (token)        => api.get('/admin/tenant', { token }),
  update:      (token, patch) => api.patch('/admin/tenant', patch, { token }),
  uploadImage,
};

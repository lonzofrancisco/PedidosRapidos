import { api, ApiError } from './client.js';

const BASE = '/api/v1';

// Sube un archivo (campo "image") a un endpoint de upload del tenant.
async function uploadTo(path, token, file) {
  const fd = new FormData();
  fd.append('image', file);

  const res = await fetch(`${BASE}${path}`, {
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
  get:              (token)        => api.get('/admin/tenant', { token }),
  update:           (token, patch) => api.patch('/admin/tenant', patch, { token }),
  uploadImage:      (token, file)  => uploadTo('/admin/tenant/image', token, file),
  uploadBackground: (token, file)  => uploadTo('/admin/tenant/background', token, file),
};

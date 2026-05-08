import { api } from './client.js';

export const productsApi = {
  // Storefront publico
  listPublic: (slug)        => api.get(`/t/${slug}/products`),
  getPublic:  (slug, id)    => api.get(`/t/${slug}/products/${id}`),

  // Admin (requiere token)
  listAdmin:  (token)            => api.get('/admin/products', { token }),
  create:     (token, payload)   => api.post('/admin/products', payload, { token }),
  update:     (token, id, patch) => api.patch(`/admin/products/${id}`, patch, { token }),
  remove:     (token, id)        => api.delete(`/admin/products/${id}`, { token }),
};

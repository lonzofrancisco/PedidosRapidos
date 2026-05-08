import { api } from './client.js';

export const ordersApi = {
  create:     (slug, payload)    => api.post(`/t/${slug}/orders`, payload),
  getPublic:  (slug, id)         => api.get(`/t/${slug}/orders/${id}`),

  listAdmin:  (token, params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit)  q.set('limit', params.limit);
    const qs = q.toString();
    return api.get(`/admin/orders${qs ? `?${qs}` : ''}`, { token });
  },
  getAdmin:    (token, id)            => api.get(`/admin/orders/${id}`, { token }),
  setStatus:   (token, id, status)    => api.patch(`/admin/orders/${id}/status`, { status }, { token }),
};

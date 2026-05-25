import { api } from './client.js';

// El token del dueno del sistema vive en una key separada de la del admin de
// tenant ('pedidos:auth'), asi no se pisan si se usan en simultaneo.
const SA_KEY = 'pedidos:superadmin';
const ADMIN_KEY = 'pedidos:auth';

export function getSuperSession() {
  try { return JSON.parse(localStorage.getItem(SA_KEY)); } catch { return null; }
}
export function setSuperSession(session) {
  if (session) localStorage.setItem(SA_KEY, JSON.stringify(session));
  else localStorage.removeItem(SA_KEY);
}

// Guarda una sesion de admin de tenant (para "entrar al panel" via impersonate).
export function setAdminSession(session) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(session));
}

export const superadminApi = {
  login:        (email, password) => api.post('/superadmin/login', { email, password }),
  listTenants:  (token)           => api.get('/superadmin/tenants', { token }),
  createTenant: (token, payload)  => api.post('/superadmin/tenants', payload, { token }),
  extend:       (token, id, days) => api.post(`/superadmin/tenants/${id}/extend`, { days }, { token }),
  updatePlan:   (token, id, patch)=> api.patch(`/superadmin/tenants/${id}/plan`, patch, { token }),
  setActive:    (token, id, active)=> api.patch(`/superadmin/tenants/${id}/active`, { active }, { token }),
  resetPassword:(token, id, password)=> api.post(`/superadmin/tenants/${id}/reset-password`, { password }, { token }),
  deleteTenant: (token, id)       => api.delete(`/superadmin/tenants/${id}`, { token }),
  impersonate:  (token, id)       => api.post(`/superadmin/tenants/${id}/impersonate`, {}, { token }),
  listAudit:    (token, limit = 100) => api.get(`/superadmin/audit?limit=${limit}`, { token }),
};

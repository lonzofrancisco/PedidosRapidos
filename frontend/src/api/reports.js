import { api } from './client.js';

export const reportsApi = {
  // Resumen de ventas para un rango ('7d' | '30d' | '90d').
  summary: (token, range = '30d') => api.get(`/admin/reports/summary?range=${range}`, { token }),
};

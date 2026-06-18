import { api } from './client.js';

export const billingApi = {
  // Genera el link de pago de Mercado Pago (Checkout Pro) para renovar el plan.
  renew:  (token) => api.post('/admin/billing/renew', {}, { token }),
  // Dice si el cobro online esta habilitado y a que precio (para la UI).
  config: (token) => api.get('/admin/billing/config', { token }),
};

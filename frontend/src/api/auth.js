import { api } from './client.js';

export const authApi = {
  login: ({ tenant_slug, email, password }) =>
    api.post('/auth/login', { tenant_slug, email, password }),

  forgotPassword: ({ email, tenant_slug }) =>
    api.post('/auth/forgot-password', { email, tenant_slug }),

  verifyResetToken: (token, tenant_slug) =>
    api.post('/auth/verify-reset-token', { token, tenant_slug }),

  resetPassword: ({ token, tenant_slug, password }) =>
    api.post('/auth/reset-password', { token, tenant_slug, password }),
};

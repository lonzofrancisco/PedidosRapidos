import { api } from './client.js';

export const authApi = {
  login: ({ tenant_slug, email, password }) =>
    api.post('/auth/login', { tenant_slug, email, password }),
};

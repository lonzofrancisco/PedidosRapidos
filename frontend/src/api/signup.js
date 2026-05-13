import { api } from './client.js';

export const signupApi = {
  create: (payload) => api.post('/signup', payload),
};

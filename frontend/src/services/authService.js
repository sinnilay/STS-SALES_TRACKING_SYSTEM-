import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/Auth/login', { email, password });
    return response.data;
  },

  changePassword: async (email, oldPassword, newPassword) => {
    const response = await api.post('/Auth/change-password', { email, oldPassword, newPassword });
    return response.data;
  },

  requestEmailChange: async (currentEmail, newEmail) => {
    const response = await api.post('/Auth/request-email-change', { currentEmail, newEmail });
    return response.data;
  },

  verifyEmailChange: async (currentEmail, otp) => {
    const response = await api.post('/Auth/verify-email-change', { currentEmail, otp });
    return response.data;
  },
};

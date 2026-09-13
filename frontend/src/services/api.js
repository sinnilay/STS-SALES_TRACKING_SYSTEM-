import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7202/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the JWT token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global errors like 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Dispatch a custom event so that AuthContext can pick it up
      window.dispatchEvent(new Event('unauthorized'));
    }
    if (error.response && error.response.status === 403 && error.response.data?.code === 'SUBSCRIPTION_EXPIRED') {
      // Company's trial/subscription expired mid-session; let AuthContext flag it
      window.dispatchEvent(new Event('subscription-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;

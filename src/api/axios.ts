import axios from 'axios';
import { getToken, clearToken } from '../utils/auth';

// Determine base URL: use VITE_API_URL if configured, otherwise default to /api/v1 on the current origin
const defaultBaseURL = `${window.location.origin}/api/v1`;
const baseURL = (import.meta as any).env.VITE_API_URL || defaultBaseURL;

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Bearer Token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized
// Only clear the token — let ProtectedRoute handle the redirect via React Router.
// Avoid window.location hard-reloads which blank the page before React can react.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

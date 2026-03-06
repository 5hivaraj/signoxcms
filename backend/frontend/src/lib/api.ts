import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

console.log('🔌 Connecting to Backend at:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  // Allow redirects from HTTP to HTTPS
  maxRedirects: 5,
  // Timeout after 10 seconds
  timeout: 10000,
  // In development, allow self-signed certificates
  // Note: This is handled by the browser, not axios in browser environment
  withCredentials: false,
});

// Request interceptor to add token and set Content-Type
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken') || localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Only set Content-Type if it's not FormData (FormData sets its own Content-Type with boundary)
  if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('🔍 API Error Interceptor:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      message: error.response?.data?.message
    });

    // Only redirect to login on 401 (Unauthorized), not on 403 (Forbidden)
    // 403 means the user is authenticated but doesn't have permission
    if (error.response?.status === 401) {
      console.log('🚪 401 Unauthorized - Logging out and redirecting to login');
      // Clear tokens and redirect to login
      Cookies.remove('accessToken');
      localStorage.removeItem('accessToken');
      
      // Only redirect if not already on login page
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.log('🔀 Redirecting to /login from:', window.location.pathname);
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      console.log('🚫 403 Forbidden - User authenticated but lacks permission');
    }
    // For 403 errors, just reject the promise without logging out
    // The calling code should handle the error appropriately
    return Promise.reject(error);
  }
);

export default api;

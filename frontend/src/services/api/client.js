import axios from 'axios';

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  return trimmed.replace(/\/+$/, '');
}

function resolveFallbackBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);

  if (/\/api\/v1$/i.test(normalized)) {
    return normalized.replace(/\/api\/v1$/i, '/api');
  }

  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v1`;
  }

  return '';
}

const baseURL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);

export const apiClient = axios.create({
  baseURL,
  timeout: 10000
});

apiClient.interceptors.request.use(
  (config) => {
    try {
      const savedAuthRaw = localStorage.getItem('auth');

      if (!savedAuthRaw) {
        return config;
      }

      const savedAuth = JSON.parse(savedAuthRaw);
      const token = savedAuth?.token || savedAuth?.accessToken || savedAuth?.access_token;

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore malformed localStorage auth payloads and continue request.
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const statusCode = Number(error?.response?.status);
    const savedAuthRaw = localStorage.getItem('auth');
    const hasSavedAuth = Boolean(savedAuthRaw);
    const requestUrl = String(originalRequest?.url || '');
    const isAuthSessionRequest =
      requestUrl.includes('/auth/verify') || requestUrl.includes('/users/profile');

    if (statusCode === 401 && hasSavedAuth && isAuthSessionRequest) {
      console.log('Unauthorized response detected - clearing stale auth and redirecting to login');
      localStorage.removeItem('auth');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login?error=' + encodeURIComponent('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return Promise.reject(error);
    }

    // Auto-logout on 403 (user account suspended/blocked/paused)
    // Any 403 means user status is not active
    if (statusCode === 403) {
      // Clear auth from localStorage
      console.log('🔴 403 detected - clearing auth and redirecting to login');
      console.log('Response message:', error?.response?.data?.message);
      localStorage.removeItem('auth');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Redirect to login with message
      const message = error?.response?.data?.message || 'Tài khoản của bạn không còn hoạt động.';
      console.log('Redirecting to login with message:', message);
      window.location.href = `/login?error=${encodeURIComponent(message)}`;
      return Promise.reject(error);
    }

    if (!originalRequest || originalRequest.__baseFallbackRetried) {
      return Promise.reject(error);
    }

    const hasResponse = Boolean(error?.response);
    const shouldAttemptFallback = !hasResponse || statusCode === 404 || statusCode === 405;

    if (!shouldAttemptFallback) {
      return Promise.reject(error);
    }

    const currentBaseUrl = normalizeBaseUrl(originalRequest.baseURL || apiClient.defaults.baseURL);
    const fallbackBaseUrl = resolveFallbackBaseUrl(currentBaseUrl);

    if (!fallbackBaseUrl || fallbackBaseUrl === currentBaseUrl) {
      return Promise.reject(error);
    }

    originalRequest.__baseFallbackRetried = true;
    originalRequest.baseURL = fallbackBaseUrl;

    return apiClient.request(originalRequest);
  }
);

export default apiClient;

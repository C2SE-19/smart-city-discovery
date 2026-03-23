import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

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
    } catch (error) {
      // Ignore malformed localStorage auth payloads and continue request.
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
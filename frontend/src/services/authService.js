import axios from 'axios';

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_URL = configuredBaseUrl.replace(/\/v1\/?$/, '');

export const authService = {
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials);
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to login' };
    }
  },

  register: async (payload) => {
    try {
      const response = await axios.post(`${API_URL}/register`, payload);
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to register' };
    }
  },

  // Google OAuth login
  loginWithGoogle: async (token) => {
    try {
      const response = await axios.post(`${API_URL}/auth/google`, {
        token,
        credential: token
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to login with Google' };
    }
  },

  // Facebook OAuth login
  loginWithFacebook: async (accessToken) => {
    try {
      const response = await axios.post(`${API_URL}/auth/facebook`, {
        accessToken
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to login with Facebook' };
    }
  },

  // Kiểm tra username đã tồn tại
  checkUsernameExists: async (username) => {
    try {
      const response = await axios.post(`${API_URL}/auth/check-username`, {
        username
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to check username' };
    }
  },

  // Kiểm tra email đã tồn tại
  checkEmailExists: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/auth/check-email`, {
        email
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to check email' };
    }
  }
};

export default authService;

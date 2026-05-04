import axios from 'axios';
import { getApiBaseUrl } from './api/client';

const API_URL = getApiBaseUrl().replace(/\/+v1\/?$/, '');

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

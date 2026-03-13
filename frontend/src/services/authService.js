import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
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
        token
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
  }
};

export default authService;

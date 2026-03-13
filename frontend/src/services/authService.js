import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const authService = {
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

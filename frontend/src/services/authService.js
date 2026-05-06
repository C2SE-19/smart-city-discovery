import { apiClient } from './api/client';

export const authService = {
  login: async (credentials) => {
    try {
      const response = await apiClient.post('/login', credentials);
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to login' };
    }
  },

  register: async (payload) => {
    try {
      const response = await apiClient.post('/register', payload);
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to register' };
    }
  },

  // Google OAuth login
  loginWithGoogle: async (token) => {
    try {
      const response = await apiClient.post('/auth/google', {
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
      const response = await apiClient.post('/auth/facebook', {
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
      const response = await apiClient.post('/auth/check-username', {
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
      const response = await apiClient.post('/auth/check-email', {
        email
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to check email' };
    }
  },

  // Forgot password - request reset email
  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to send password reset email' };
    }
  },

  // Verify reset token
  verifyResetToken: async (token) => {
    try {
      const response = await apiClient.post('/auth/verify-reset-token', {
        token
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to verify reset token' };
    }
  },

  // Reset password with token
  resetPassword: async (token, password, confirmPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        password,
        confirmPassword
      });
      return response.data;
    } catch (err) {
      throw err.response?.data || { message: 'Failed to reset password' };
    }
  }
};

export default authService;

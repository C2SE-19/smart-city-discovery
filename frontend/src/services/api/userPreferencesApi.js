import apiClient from './client';

export async function fetchUserPreferenceOptions() {
  const response = await apiClient.get('/users/preferences/options');
  return response.data;
}

export async function fetchUserPreferences() {
  const response = await apiClient.get('/users/preferences');
  return response.data;
}

export async function saveUserPreferences(payload) {
  const response = await apiClient.put('/users/preferences', payload);
  return response.data;
}

export async function fetchForYouRecommendations(params = {}) {
  const response = await apiClient.get('/users/recommendations', { params });
  return response.data;
}

import apiClient from './client';

export async function fetchLandingStats() {
  const response = await apiClient.get('/landing/stats');
  return response?.data?.stats || response?.data || null;
}

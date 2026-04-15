import apiClient from './client';

export async function fetchDaNangFeaturedPlaces() {
  const response = await apiClient.get('/landing/da-nang-places');
  return response?.data?.data || response?.data || [];
}

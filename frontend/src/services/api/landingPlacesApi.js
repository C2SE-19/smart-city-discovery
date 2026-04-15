import apiClient from './client';

export async function fetchLandingPlaces() {
  const response = await apiClient.get('/landing/places-list');
  return response?.data?.data || response?.data || [];
}

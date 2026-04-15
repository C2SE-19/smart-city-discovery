import apiClient from './client';

export async function searchVenuesByImage(payload = {}) {
  const response = await apiClient.post('/vision/image-search', payload);
  return response.data;
}

import apiClient from './client';

export async function searchVenuesByImage(payload = {}) {
  const response = await apiClient.post('/vision/image-search', payload, {
    timeout: 90000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
  return response.data;
}

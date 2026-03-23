import apiClient from './api/client';

export async function fetchTerms() {
  const response = await apiClient.get('/terms');
  return response.data;
}

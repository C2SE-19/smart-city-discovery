import apiClient from './client';

export async function fetchWards() {
  const response = await apiClient.get('/wards');
  return response.data;
}
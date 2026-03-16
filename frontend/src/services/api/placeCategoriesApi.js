import apiClient from './client';

export async function fetchPlaceCategories(params = {}) {
  const response = await apiClient.get('/place-categories', {
    params,
  });

  return response.data;
}

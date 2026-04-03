import apiClient from './client';

export async function fetchVenues(params = {}) {
  const response = await apiClient.get('/venues', {
    params,
  });

  return response.data;
}

export async function createVenueRequest(payload) {
  const response = await apiClient.post('/venues', payload);
  return response.data;
}

export async function detectWardRequest(payload) {
  const response = await apiClient.post('/gis/detect-ward', payload);
  return response.data;
}
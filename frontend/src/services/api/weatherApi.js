import apiClient from './client';

export async function fetchCurrentWeather(params = {}) {
  const response = await apiClient.get('/weather/current', {
    params,
  });

  return response.data;
}

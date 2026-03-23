import apiClient from './client';

export async function fetchMerchantServices(params = {}) {
  const response = await apiClient.get('/merchant-services', {
    params,
  });

  return response.data;
}

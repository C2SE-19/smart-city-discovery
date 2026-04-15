import apiClient from './client';

export async function fetchLandingServiceDetail(slug) {
  if (!slug) {
    return null;
  }

  const response = await apiClient.get(`/landing/services/${slug}`);
  return response?.data?.data || response?.data || null;
}

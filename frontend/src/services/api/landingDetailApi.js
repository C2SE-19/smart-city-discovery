import apiClient from './client';

export async function fetchLandingDetail(slug) {
  if (!slug) {
    return null;
  }

  const response = await apiClient.get(`/landing/details/${slug}`);
  return response?.data?.data || response?.data || null;
}

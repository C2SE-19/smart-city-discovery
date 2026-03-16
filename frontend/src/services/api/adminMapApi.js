import apiClient from './client';

export async function fetchAdminWards() {
  const response = await apiClient.get('/admin/wards');
  return response.data;
}

export async function upsertAdminWard(payload) {
  const response = await apiClient.post('/admin/wards', payload);
  return response.data;
}

export async function deleteAdminWard(wardId) {
  const response = await apiClient.delete(`/admin/wards/${wardId}`);
  return response.data;
}

export async function fetchAdminVenues(params = {}) {
  const response = await apiClient.get('/admin/venues', {
    params,
  });

  return response.data;
}

export async function moderateAdminVenue(venueId, payload) {
  const response = await apiClient.patch(`/admin/venues/${venueId}/moderation`, payload);
  return response.data;
}

export async function fetchAdminPlaceCategories(params = {}) {
  const response = await apiClient.get('/admin/place-categories', {
    params,
  });

  return response.data;
}

export async function createAdminPlaceCategory(payload) {
  const response = await apiClient.post('/admin/place-categories', payload);
  return response.data;
}

export async function updateAdminPlaceCategory(categoryId, payload) {
  const response = await apiClient.patch(`/admin/place-categories/${categoryId}`, payload);
  return response.data;
}

export async function deleteAdminPlaceCategory(categoryId) {
  const response = await apiClient.delete(`/admin/place-categories/${categoryId}`);
  return response.data;
}

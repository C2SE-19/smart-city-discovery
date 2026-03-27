import apiClient from './client';

export async function fetchAdminWards() {
  const response = await apiClient.get('/admin/wards', {
    timeout: 30000,
  });
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
    timeout: 30000,
  });

  return response.data;
}

export async function fetchAdminVenueDetail(venueId) {
  const response = await apiClient.get(`/admin/venues/${venueId}`, {
    timeout: 30000,
  });

  return response.data;
}

export async function moderateAdminVenue(venueId, payload) {
  const response = await apiClient.patch(`/admin/venues/${venueId}/moderation`, payload);
  return response.data;
}

export async function fetchAdminVenueReviews(venueId, params = {}) {
  const response = await apiClient.get(`/admin/venues/${venueId}/reviews`, {
    params,
  });

  return response.data;
}

export async function sendAdminVenueModerationMessage(venueId, payload) {
  const formData = new FormData();
  formData.append('message', payload.message || '');

  if (Array.isArray(payload.attachments)) {
    payload.attachments.slice(0, 5).forEach((file) => {
      if (file) {
        formData.append('attachments', file);
      }
    });
  }

  const response = await apiClient.post(`/admin/venues/${venueId}/message`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

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

export async function fetchAdminMerchantServices(params = {}) {
  const response = await apiClient.get('/admin/merchant-services', {
    params,
  });

  return response.data;
}

export async function createAdminMerchantService(payload) {
  const response = await apiClient.post('/admin/merchant-services', payload);
  return response.data;
}

export async function updateAdminMerchantService(serviceId, payload) {
  const response = await apiClient.patch(`/admin/merchant-services/${serviceId}`, payload);
  return response.data;
}

export async function deleteAdminMerchantService(serviceId) {
  const response = await apiClient.delete(`/admin/merchant-services/${serviceId}`);
  return response.data;
}

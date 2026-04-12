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

export async function fetchAdminVenueReviews(venueId, params = {}) {
  const response = await apiClient.get(`/admin/venues/${venueId}/reviews`, {
    params,
    timeout: 30000,
  });

  return response.data;
}

export async function createAdminVenueReviewReply(venueId, reviewId, payload) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await apiClient.post(`/venues/${venueId}/reviews/${reviewId}/replies`, payload, isFormData
    ? {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
    : undefined);
  return response.data;
}

export async function createAdminVenueReview(venueId, payload) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await apiClient.post(`/venues/${venueId}/reviews`, payload, isFormData
    ? {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
    : undefined);
  return response.data;
}

export async function deleteAdminVenueReview(venueId, reviewId) {
  const response = await apiClient.delete(`/venues/${venueId}/reviews/${reviewId}`);
  return response.data;
}

export async function deleteAdminVenueReviewReply(venueId, reviewId, replyId) {
  const response = await apiClient.delete(`/venues/${venueId}/reviews/${reviewId}/replies/${replyId}`);
  return response.data;
}

export async function moderateAdminVenue(venueId, payload) {
  const response = await apiClient.patch(`/admin/venues/${venueId}/moderation`, payload);
  return response.data;
}

export async function fetchAdminVenueUpdateRequests(params = {}) {
  const response = await apiClient.get('/admin/venues/update-requests', {
    params,
    timeout: 30000,
  });

  return response.data;
}

export async function moderateAdminVenueUpdateRequest(requestId, payload) {
  const response = await apiClient.patch(`/admin/venues/update-requests/${requestId}/moderation`, payload);
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

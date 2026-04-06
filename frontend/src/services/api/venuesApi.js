import apiClient from './client';

const venuesCache = new Map();
const venuesInFlight = new Map();
const VENUES_CACHE_TTL_MS = 8000;

function buildVenuesCacheKey(params = {}) {
  const normalized = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});

  return JSON.stringify(normalized);
}

export async function fetchVenues(params = {}) {
  const cacheKey = buildVenuesCacheKey(params);
  const now = Date.now();
  const cached = venuesCache.get(cacheKey);

  if (cached && now - cached.timestamp < VENUES_CACHE_TTL_MS) {
    return cached.data;
  }

  if (venuesInFlight.has(cacheKey)) {
    return venuesInFlight.get(cacheKey);
  }

  const request = apiClient
    .get('/venues', {
      params,
    })
    .then((response) => {
      venuesCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    })
    .finally(() => {
      venuesInFlight.delete(cacheKey);
    });

  venuesInFlight.set(cacheKey, request);
  return request;
}

export async function fetchMyVenueSubmissions(params = {}) {
  const response = await apiClient.get('/venues', {
    params: {
      mine: true,
      ...params,
    },
  });

  return response.data;
}

export async function createVenueRequest(payload) {
  const response = await apiClient.post('/venues', payload);
  return response.data;
}

export async function fetchVenueDetails(venueId) {
  const response = await apiClient.get(`/venues/${venueId}`);
  return response.data;
}

export async function fetchVenueReviews(venueId, params = {}) {
  const response = await apiClient.get(`/venues/${venueId}/reviews`, {
    params,
  });

  return response.data;
}

export async function fetchVenueCommunityBundle(venueId) {
  const response = await apiClient.get(`/venues/${venueId}/community`);
  return response.data;
}

export async function fetchVenueOpeningHoursRealtime(venueId) {
  const response = await apiClient.get(`/venues/${venueId}/opening-hours`);
  return response.data;
}

export async function createVenueReview(venueId, payload) {
  const response = await apiClient.post(`/venues/${venueId}/reviews`, payload, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

export async function toggleVenueReviewLike(venueId, reviewId) {
  const response = await apiClient.post(`/venues/${venueId}/reviews/${reviewId}/like`);
  return response.data;
}

export async function createVenueReviewReply(venueId, reviewId, payload) {
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

export async function deleteVenueReview(venueId, reviewId) {
  const response = await apiClient.delete(`/venues/${venueId}/reviews/${reviewId}`);
  return response.data;
}

export async function detectWardRequest(payload) {
  const response = await apiClient.post('/gis/detect-ward', payload);
  return response.data;
}

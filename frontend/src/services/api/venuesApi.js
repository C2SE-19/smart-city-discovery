import apiClient from './client';

const venuesCache = new Map();
const venuesInFlight = new Map();
const VENUES_CACHE_TTL_MS = 8000;
const venueDetailCache = new Map();
const venueDetailInFlight = new Map();
const venueCommunityCache = new Map();
const venueCommunityInFlight = new Map();
const VENUE_DETAIL_CACHE_TTL_MS = 15000;
const VENUE_COMMUNITY_CACHE_TTL_MS = 8000;

function clearVenuesListCaches() {
  venuesCache.clear();
  venuesInFlight.clear();
}

function invalidateVenueScopedCaches(venueId) {
  const cacheKey = String(venueId || '').trim();
  if (!cacheKey) {
    return;
  }

  venueDetailCache.delete(cacheKey);
  venueCommunityCache.delete(cacheKey);
}

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

export async function fetchMyVenueUpdateRequests(params = {}) {
  const response = await apiClient.get('/venues/update-requests', {
    params,
  });

  return response.data;
}

export async function createVenueRequest(payload) {
  const response = await apiClient.post('/venues', payload);
  clearVenuesListCaches();
  return response.data;
}

export async function fetchVenueEditDraft(venueId) {
  const response = await apiClient.get(`/venues/${venueId}/edit-draft`);
  return response.data;
}

export async function submitVenueUpdateRequest(venueId, payload) {
  const response = await apiClient.post(`/venues/${venueId}/update-request`, payload);
  invalidateVenueScopedCaches(venueId);
  clearVenuesListCaches();
  return response.data;
}

export async function updateVenueSimpleInfo(venueId, payload) {
  const response = await apiClient.patch(`/venues/${venueId}/simple-update`, payload);
  invalidateVenueScopedCaches(venueId);
  clearVenuesListCaches();
  return response.data;
}

export async function toggleMerchantVenuePauseStatus(venueId) {
  const response = await apiClient.patch(`/venues/${venueId}/pause-toggle`);
  invalidateVenueScopedCaches(venueId);
  clearVenuesListCaches();
  return response.data;
}

export async function deleteMerchantVenuePost(venueId) {
  const response = await apiClient.delete(`/venues/${venueId}`);
  invalidateVenueScopedCaches(venueId);
  clearVenuesListCaches();
  return response.data;
}

export async function fetchVenueDetails(venueId) {
  const cacheKey = String(venueId || '').trim();
  const now = Date.now();
  const cached = venueDetailCache.get(cacheKey);

  if (cached && now - cached.timestamp < VENUE_DETAIL_CACHE_TTL_MS) {
    return cached.data;
  }

  if (venueDetailInFlight.has(cacheKey)) {
    return venueDetailInFlight.get(cacheKey);
  }

  const request = apiClient
    .get(`/venues/${venueId}`)
    .then((response) => {
      venueDetailCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    })
    .finally(() => {
      venueDetailInFlight.delete(cacheKey);
    });

  venueDetailInFlight.set(cacheKey, request);
  return request;
}

export async function fetchVenueReviews(venueId, params = {}) {
  const response = await apiClient.get(`/venues/${venueId}/reviews`, {
    params,
  });

  return response.data;
}

export async function fetchVenueCommunityBundle(venueId) {
  const cacheKey = String(venueId || '').trim();
  const now = Date.now();
  const cached = venueCommunityCache.get(cacheKey);

  if (cached && now - cached.timestamp < VENUE_COMMUNITY_CACHE_TTL_MS) {
    return cached.data;
  }

  if (venueCommunityInFlight.has(cacheKey)) {
    return venueCommunityInFlight.get(cacheKey);
  }

  const request = apiClient
    .get(`/venues/${venueId}/community`)
    .then((response) => {
      venueCommunityCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    })
    .finally(() => {
      venueCommunityInFlight.delete(cacheKey);
    });

  venueCommunityInFlight.set(cacheKey, request);
  return request;
}

export async function fetchVenueOpeningHoursRealtime(venueId) {
  const response = await apiClient.get(`/venues/${venueId}/opening-hours`);
  return response.data;
}

export async function fetchVenueServices(venueId) {
  const response = await apiClient.get(`/venues/${venueId}/services`);
  return response.data;
}

export async function createVenueReview(venueId, payload) {
  const response = await apiClient.post(`/venues/${venueId}/reviews`, payload, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  invalidateVenueScopedCaches(venueId);

  return response.data;
}

export async function toggleVenueReviewLike(venueId, reviewId) {
  const response = await apiClient.post(`/venues/${venueId}/reviews/${reviewId}/like`);
  invalidateVenueScopedCaches(venueId);
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
  invalidateVenueScopedCaches(venueId);
  return response.data;
}

export async function toggleVenueReviewReplyLike(venueId, reviewId, replyId) {
  const response = await apiClient.post(`/venues/${venueId}/reviews/${reviewId}/replies/${replyId}/like`);
  invalidateVenueScopedCaches(venueId);
  return response.data;
}

export async function deleteVenueReview(venueId, reviewId) {
  const response = await apiClient.delete(`/venues/${venueId}/reviews/${reviewId}`);
  invalidateVenueScopedCaches(venueId);
  return response.data;
}

export async function deleteVenueReviewReply(venueId, reviewId, replyId) {
  const response = await apiClient.delete(`/venues/${venueId}/reviews/${reviewId}/replies/${replyId}`);
  invalidateVenueScopedCaches(venueId);
  return response.data;
}

export async function updateVenueReview(venueId, reviewId, payload) {
  const response = await apiClient.patch(`/venues/${venueId}/reviews/${reviewId}`, payload, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  invalidateVenueScopedCaches(venueId);
  return response.data;
}

export async function detectWardRequest(payload) {
  const response = await apiClient.post('/gis/detect-ward', payload);
  return response.data;
}

export async function geocodeVenueAddress(payload, options = {}) {
  const { signal, timeout = 6500 } = options || {};
  const response = await apiClient.post('/gis/geocode-address', payload, {
    signal,
    timeout,
  });
  return response.data;
}

export function clearVenueDetailCache(venueId) {
  invalidateVenueScopedCaches(venueId);
  clearVenuesListCaches();
}


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

export async function detectWardRequest(payload) {
  const response = await apiClient.post('/gis/detect-ward', payload);
  return response.data;
}
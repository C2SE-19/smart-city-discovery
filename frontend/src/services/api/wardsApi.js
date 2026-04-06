import apiClient from './client';

const wardsCache = new Map();
const wardsInFlight = new Map();
const WARDS_CACHE_TTL_MS = 15000;

function buildWardsCacheKey(params = {}) {
  const normalized = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});

  return JSON.stringify(normalized);
}

export async function fetchWards(params = {}) {
  const cacheKey = buildWardsCacheKey(params);
  const now = Date.now();
  const cached = wardsCache.get(cacheKey);

  if (cached && now - cached.timestamp < WARDS_CACHE_TTL_MS) {
    return cached.data;
  }

  if (wardsInFlight.has(cacheKey)) {
    return wardsInFlight.get(cacheKey);
  }

  const request = apiClient
    .get('/wards', { params })
    .then((response) => {
      wardsCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    })
    .finally(() => {
      wardsInFlight.delete(cacheKey);
    });

  wardsInFlight.set(cacheKey, request);
  return request;
}
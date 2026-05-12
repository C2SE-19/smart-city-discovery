import apiClient from './client';

const weatherCache = new Map();
const weatherInFlight = new Map();
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

function buildWeatherCacheKey(params = {}) {
  const latitude = Number(params?.latitude);
  const longitude = Number(params?.longitude);

  return JSON.stringify({
    latitude: Number.isFinite(latitude) ? latitude.toFixed(3) : '',
    longitude: Number.isFinite(longitude) ? longitude.toFixed(3) : '',
  });
}

export async function fetchCurrentWeather(params = {}) {
  const cacheKey = buildWeatherCacheKey(params);
  const now = Date.now();
  const cached = weatherCache.get(cacheKey);

  if (cached && now - cached.timestamp < WEATHER_CACHE_TTL_MS) {
    return cached.data;
  }

  if (weatherInFlight.has(cacheKey)) {
    return weatherInFlight.get(cacheKey);
  }

  const request = apiClient.get('/weather/current', {
    params,
  })
    .then((response) => {
      weatherCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    })
    .finally(() => {
      weatherInFlight.delete(cacheKey);
    });

  weatherInFlight.set(cacheKey, request);
  return request;
}

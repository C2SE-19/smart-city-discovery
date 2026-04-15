import { apiClient } from './client';

const citiesCache = new Map();
const citiesInFlight = new Map();
const CITIES_CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Lấy danh sách thành phố kèm số lượng địa điểm
 * @returns {Promise<Array>} Danh sách thành phố
 */
export async function fetchCitiesWithStats() {
  const cacheKey = 'cities-stats';
  const now = Date.now();
  const cached = citiesCache.get(cacheKey);

  // Kiểm tra cache
  if (cached && now - cached.timestamp < CITIES_CACHE_TTL_MS) {
    return cached.data;
  }

  // Kiểm tra nếu request đang thực hiện
  if (citiesInFlight.has(cacheKey)) {
    return citiesInFlight.get(cacheKey);
  }

  // Thực hiện request
  const request = apiClient
    .get('/cities/stats')
    .then((response) => {
      const cities = Array.isArray(response.data) ? response.data : [];
      citiesCache.set(cacheKey, { data: cities, timestamp: Date.now() });
      return cities;
    })
    .catch((error) => {
      console.error('Error fetching cities:', error);
      // Trả về danh sách mặc định nếu lỗi
      return [
        { id: 'da-nang', name: 'Đà Nẵng', count: 153 },
        { id: 'hoi-an', name: 'Hội An', count: 97 },
        { id: 'hue', name: 'Huế', count: 142 },
        { id: 'ho-chi-minh', name: 'TP. Hồ Chí Minh', count: 305 }
      ];
    })
    .finally(() => {
      citiesInFlight.delete(cacheKey);
    });

  citiesInFlight.set(cacheKey, request);
  return request;
}

/**
 * Làm mới cache dữ liệu thành phố
 */
export function invalidateCitiesCache() {
  citiesCache.clear();
  citiesInFlight.clear();
}

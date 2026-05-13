import apiClient from './client';

const trendingVenuesCache = new Map();
const trendingVenuesInFlight = new Map();
const TRENDING_VENUES_CACHE_TTL_MS = 60 * 1000;

export function invalidateTrendingVenuesCache() {
  trendingVenuesCache.clear();
  trendingVenuesInFlight.clear();
}

export async function fetchPublicAdPackages() {
  const response = await apiClient.get('/ad-packages');

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function createAdminAdPackage(payload) {
  const response = await apiClient.post('/admin/ad-packages', payload);
  return response.data;
}

export async function updateAdminAdPackage(packageId, payload) {
  const response = await apiClient.patch(`/admin/ad-packages/${packageId}`, payload);
  return response.data;
}

export async function deleteAdminAdPackage(packageId) {
  const response = await apiClient.delete(`/admin/ad-packages/${packageId}`);
  return response.data;
}

export async function fetchAdminAdPackageStats(months = 6) {
  const response = await apiClient.get('/admin/ad-packages/stats', {
    params: {
      months,
    },
  });

  return response.data;
}

export async function fetchAdminAdPackageUsages(packageId, month) {
  const response = await apiClient.get(`/admin/ad-packages/${packageId}/usages`, {
    params: {
      month,
    },
  });

  return response.data;
}

export async function assignAdPackageToVenue(packageId, payload) {
  const response = await apiClient.post(`/ad-packages/${packageId}/assign`, payload);
  return response.data;
}

export async function fetchVenueAdPackageAssignment(venueId) {
  const response = await apiClient.get(`/ad-packages/assignments/venues/${venueId}`);
  return response.data?.assignment || null;
}

export async function fetchMerchantAdPackageTransactions() {
  const response = await apiClient.get('/merchant/ad-packages/transactions');
  return {
    summary: response.data?.summary || {},
    transactions: Array.isArray(response.data?.transactions) ? response.data.transactions : [],
  };
}

export async function fetchMerchantAdPackageCheckoutStatus(transactionId) {
  const response = await apiClient.get(`/merchant/ad-packages/transactions/${transactionId}/status`);
  return {
    success: Boolean(response.data?.success),
    isPaid: Boolean(response.data?.isPaid),
    purchase: response.data?.purchase || null,
  };
}

export async function deleteMerchantAdPackageTransaction(transactionId) {
  const response = await apiClient.delete(`/merchant/ad-packages/transactions/${transactionId}`);
  return response.data;
}

export async function activateMerchantAdPackageTransaction(transactionId) {
  const response = await apiClient.post(`/merchant/ad-packages/transactions/${transactionId}/activate`);
  return response.data;
}

export async function deactivateMerchantAdPackageTransaction(transactionId) {
  const response = await apiClient.post(`/merchant/ad-packages/transactions/${transactionId}/deactivate`);
  return response.data;
}

export async function fetchAdminRevenueReport(months = 6) {
  const response = await apiClient.get('/admin/reports/revenue', {
    params: {
      months,
    },
  });

  return response.data;
}

export async function fetchAdminDashboardOverview(months = 6) {
  const response = await apiClient.get('/admin/dashboard/overview', {
    params: {
      months,
    },
  });

  return response.data;
}

export async function fetchTrendingVenues(limit = 10, options = {}) {
  const normalizedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 10;
  const cacheKey = `limit:${normalizedLimit}`;
  const shouldForceRefresh = Boolean(options?.force);
  const now = Date.now();
  const cached = trendingVenuesCache.get(cacheKey);

  if (!shouldForceRefresh && cached && now - cached.timestamp < TRENDING_VENUES_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!shouldForceRefresh && trendingVenuesInFlight.has(cacheKey)) {
    return trendingVenuesInFlight.get(cacheKey);
  }

  if (shouldForceRefresh) {
    trendingVenuesCache.delete(cacheKey);
    trendingVenuesInFlight.delete(cacheKey);
  }

  const request = apiClient.get('/ad-packages/trending/venues', {
    params: { limit: normalizedLimit },
  })
    .then((response) => {
      const rows = Array.isArray(response.data?.venues) ? response.data.venues : [];
      trendingVenuesCache.set(cacheKey, { data: rows, timestamp: Date.now() });
      return rows;
    })
    .finally(() => {
      trendingVenuesInFlight.delete(cacheKey);
    });

  trendingVenuesInFlight.set(cacheKey, request);
  return request;
}

export async function trackTrendingAssignmentClick(assignmentId, source = 'overview', clickToken = '') {
  const response = await apiClient.post(`/ad-packages/trending/assignments/${assignmentId}/click`, {
    source,
    clickToken: clickToken || undefined,
  });

  return response.data;
}

export async function fetchMerchantTrendingOverview(days = 7) {
  const response = await apiClient.get('/merchant/ad-trending/overview', {
    params: { days },
  });

  return response.data;
}

export async function pushMerchantTrendingVenue(venueId) {
  const response = await apiClient.post(`/merchant/ad-trending/venues/${venueId}/push`);
  invalidateTrendingVenuesCache();
  return response.data;
}

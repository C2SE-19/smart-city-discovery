import apiClient from './client';

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

export async function fetchTrendingVenues(limit = 10) {
  const response = await apiClient.get('/ad-packages/trending/venues', {
    params: { limit },
  });

  return Array.isArray(response.data?.venues) ? response.data.venues : [];
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
  return response.data;
}

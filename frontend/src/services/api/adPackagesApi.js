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

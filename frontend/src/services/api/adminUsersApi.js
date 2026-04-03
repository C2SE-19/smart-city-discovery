import apiClient from './client';

export async function fetchAdminUsers({ search, role } = {}) {
  // Support both the legacy /users endpoint and the new /admin/users endpoint.
  // This helps avoid token/route mismatch when backend mount points vary.
  const endpoint = '/users';

  const response = await apiClient.get(endpoint, {
    params: {
      q: search,
      role,
    },
  });

  return response.data;
}

export async function updateAdminUser(userId, payload) {
  const response = await apiClient.put(`/admin/users/${userId}`, payload);
  return response.data;
}

export async function createAdminUser(payload) {
  const response = await apiClient.post('/admin/users', payload);
  return response.data;
}
export async function deleteAdminUser(userId) {
  const response = await apiClient.delete(`/admin/users/${userId}`);
  return response.data;
}

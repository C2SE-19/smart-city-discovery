import apiClient from './client';

export async function fetchUserNotifications(limit = 20) {
  const response = await apiClient.get('/users/notifications', {
    params: { limit }
  });

  return {
    notifications: response?.data?.notifications || [],
    unreadCount: Number(response?.data?.unreadCount || 0)
  };
}

export async function markUserNotificationsRead(ids = []) {
  const payload = Array.isArray(ids) && ids.length ? { ids } : {};
  const response = await apiClient.patch('/users/notifications/read', payload);
  return {
    success: Boolean(response?.data?.success),
    updatedCount: Number(response?.data?.updatedCount || 0)
  };
}

export function resolveNotificationsStreamUrl(token, limit = 20) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return '';
  }

  const rawBaseUrl = String(apiClient.defaults.baseURL || '').replace(/\/+$/, '');
  const streamBaseUrl = /\/api\/v1$/i.test(rawBaseUrl)
    ? rawBaseUrl
    : /\/api$/i.test(rawBaseUrl)
      ? `${rawBaseUrl}/v1`
      : `${rawBaseUrl}/api/v1`;

  const params = new URLSearchParams({
    token: normalizedToken,
    limit: String(limit)
  });

  return `${streamBaseUrl}/users/notifications/stream?${params.toString()}`;
}

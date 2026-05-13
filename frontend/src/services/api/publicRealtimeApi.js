import apiClient from './client';

export function resolvePublicOverviewStreamUrl() {
  const rawBaseUrl = String(apiClient.defaults.baseURL || '').replace(/\/+$/, '');
  const streamBaseUrl = /\/api\/v1$/i.test(rawBaseUrl)
    ? rawBaseUrl
    : /\/api$/i.test(rawBaseUrl)
      ? `${rawBaseUrl}/v1`
      : `${rawBaseUrl}/api/v1`;

  return `${streamBaseUrl}/public/overview/stream`;
}

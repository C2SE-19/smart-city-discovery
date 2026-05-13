import apiClient from './client';

function resolveAuthHeaders(authToken) {
  const normalizedToken = String(authToken || '').replace(/^Bearer\s+/i, '').trim();

  if (!normalizedToken) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${normalizedToken}`
  };
}

function normalizeChatHistory(chatHistory = []) {
  if (!Array.isArray(chatHistory)) {
    return [];
  }

  return chatHistory
    .map((item) => {
      if (!item) {
        return null;
      }

      const role = item.role
        ? String(item.role).toLowerCase()
        : String(item.sender || '').toLowerCase() === 'user'
        ? 'user'
        : 'assistant';

      const content = String(item.content || item.text || item.message || '').trim();

      return role && content ? { role, content } : null;
    })
    .filter(Boolean);
}

export async function sendAiChatMessage(message, chatHistory = [], authToken = '', location = null) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const response = await apiClient.post('/chat-v2', {
    message,
    chatHistory: normalizeChatHistory(chatHistory),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
          latitude,
          longitude
        }
      : {})
  }, {
    headers: resolveAuthHeaders(authToken)
  });

  return response.data;
}

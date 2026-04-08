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

function getCurrentAuthUserId() {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    return String(auth?.user?.id || '').trim();
  } catch {
    return '';
  }
}

function normalizeMessage(message, currentUserId) {
  const senderUserId = String(message?.senderUserId || '').trim();
  const recipientUserId = String(message?.recipientUserId || '').trim();
  const resolvedCurrentUserId = String(currentUserId || '').trim();
  const isMine = Boolean(resolvedCurrentUserId) && senderUserId === resolvedCurrentUserId;

  return {
    id: message?.id,
    sender: isMine ? 'customer' : 'seller',
    senderUserId,
    recipientUserId,
    author: isMine ? 'Bạn' : String(message?.senderName || 'Chủ quán'),
    content: String(message?.content || ''),
    createdAt: message?.createdAt || message?.created_at || new Date().toISOString(),
    venueId: message?.venueId || null,
    contextLabel: String(message?.contextLabel || message?.context_label || ''),
    venueName: message?.venueName || '',
    venueAddress: message?.venueAddress || '',
    venueImage: message?.venueImage || '',
    venueWardName: message?.venueWardName || ''
  };
}

function normalizeContextOptions(options) {
  return (Array.isArray(options) ? options : []).map((option) => ({
    id: option?.id ?? null,
    name: String(option?.name || option?.title || ''),
    address: String(option?.address || ''),
    coverImageUrl: String(option?.coverImageUrl || option?.cover_image_url || ''),
    wardName: String(option?.wardName || option?.ward_name || '')
  }));
}

function normalizeThread(thread, currentUserId) {
  return {
    id: thread?.id || null,
    ownerUserId: String(thread?.ownerUserId || '').trim(),
    customerUserId: String(thread?.customerUserId || '').trim(),
    ownerName: String(thread?.ownerName || 'Chủ quán'),
    customerName: String(thread?.customerName || 'Khách hàng'),
    counterpartName: String(thread?.counterpartName || thread?.ownerName || 'Chủ quán'),
    unreadCount: Math.max(0, Number(thread?.unreadCount || 0)),
    venueId: thread?.venueId || null,
    venueName: thread?.venueName || '',
    venueAddress: thread?.venueAddress || '',
    venueImage: thread?.venueImage || '',
    venueWardName: thread?.venueWardName || '',
    lastMessage: thread?.lastMessage
      ? {
          id: thread.lastMessage.id,
          content: String(thread.lastMessage.content || ''),
          createdAt: thread.lastMessage.createdAt || new Date().toISOString(),
          venueId: thread.lastMessage.venueId || null
        }
      : null,
    messages: Array.isArray(thread?.messages)
      ? thread.messages.map((message) => normalizeMessage(message, currentUserId))
      : []
  };
}

export async function fetchChatThreads(limit = 6, authToken = '') {
  const response = await apiClient.get('/chat/threads', {
    params: { limit },
    headers: resolveAuthHeaders(authToken)
  });

  const currentUserId = getCurrentAuthUserId();
  const threads = Array.isArray(response.data?.threads) ? response.data.threads : [];
  return threads.map((thread) => normalizeThread(thread, currentUserId));
}

export async function fetchVenueChatThread(venueId, options = {}, authToken = '') {
  const response = await apiClient.get(`/chat/venues/${venueId}`, {
    params: options?.threadId ? { threadId: options.threadId } : {},
    headers: resolveAuthHeaders(authToken)
  });

  const currentUserId = getCurrentAuthUserId();
  return {
    venueContext: response.data?.venueContext || null,
    contextOptions: normalizeContextOptions(response.data?.contextOptions),
    thread: response.data?.thread ? normalizeThread(response.data.thread, currentUserId) : null
  };
}

export async function sendVenueChatMessage(venueId, payload, authToken = '') {
  const response = await apiClient.post(`/chat/venues/${venueId}/messages`, payload, {
    headers: resolveAuthHeaders(authToken)
  });
  const currentUserId = getCurrentAuthUserId();
  return {
    thread: response.data?.thread ? normalizeThread(response.data.thread, currentUserId) : null
  };
}

export async function markChatThreadRead(threadId, authToken = '') {
  if (!threadId) {
    return null;
  }

  const response = await apiClient.post(`/chat/threads/${threadId}/read`, null, {
    headers: resolveAuthHeaders(authToken)
  });
  return response.data;
}

export async function deleteChatThread(threadId, authToken = '') {
  if (!threadId) {
    return null;
  }

  const response = await apiClient.delete(`/chat/threads/${threadId}`, {
    headers: resolveAuthHeaders(authToken)
  });
  return response.data;
}

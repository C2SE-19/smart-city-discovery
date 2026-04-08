const STORAGE_KEY = 'smart-city-venue-chat-threads';
const CHAT_EVENT = 'smart-city-chat-updated';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseThreads(rawValue) {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readThreads() {
  if (!canUseStorage()) {
    return {};
  }

  return parseThreads(window.localStorage.getItem(STORAGE_KEY));
}

function writeThreads(threads) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: threads }));
}

function sanitizeMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const content = String(message.content || '').trim();
  if (!content) {
    return null;
  }

  const sender = String(message.sender || 'customer').trim().toLowerCase() === 'seller' ? 'seller' : 'customer';
  const author = String(message.author || (sender === 'seller' ? 'Người bán' : 'Khách hàng')).trim();
  const createdAt = String(message.createdAt || new Date().toISOString());

  return {
    id: String(message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    sender,
    author: author || (sender === 'seller' ? 'Người bán' : 'Khách hàng'),
    content,
    createdAt
  };
}

function normalizeThread(thread, venueInfo = {}) {
  const messages = Array.isArray(thread?.messages)
    ? thread.messages.map(sanitizeMessage).filter(Boolean)
    : [];

  return {
    ownerKey: String(thread?.ownerKey || venueInfo.ownerKey || '').trim(),
    ownerName: String(thread?.ownerName || venueInfo.ownerName || 'Chủ quán').trim(),
    venueId: String(thread?.venueId || venueInfo.id || '').trim(),
    venueName: String(thread?.venueName || venueInfo.name || venueInfo.title || 'Quán chưa đặt tên').trim(),
    venueAddress: String(thread?.venueAddress || venueInfo.address || '').trim(),
    venueWard: String(thread?.venueWard || venueInfo.ward_name || venueInfo.wardName || '').trim(),
    venueImage: String(thread?.venueImage || venueInfo.cover_image_url || venueInfo.coverImageUrl || venueInfo.image || '').trim(),
    venuePrice: String(thread?.venuePrice || venueInfo.price || '').trim(),
    venueStatus: String(thread?.venueStatus || '').trim(),
    unreadCount: Math.max(0, Number(thread?.unreadCount || 0)),
    updatedAt: String(thread?.updatedAt || messages[messages.length - 1]?.createdAt || new Date().toISOString()),
    messages
  };
}

export function getVenueChatThread(venueId, venueInfo = {}) {
  const normalizedVenueId = String(venueId || '').trim();
  if (!normalizedVenueId) {
    return normalizeThread(null, venueInfo);
  }

  const threads = readThreads();
  return normalizeThread(threads[normalizedVenueId], { ...venueInfo, id: normalizedVenueId });
}

export function saveVenueChatThread(venueId, nextThread, venueInfo = {}) {
  const normalizedVenueId = String(venueId || '').trim();
  if (!normalizedVenueId) {
    return normalizeThread(null, venueInfo);
  }

  const threads = readThreads();
  const normalizedThread = normalizeThread(nextThread, { ...venueInfo, id: normalizedVenueId });
  threads[normalizedVenueId] = normalizedThread;
  writeThreads(threads);
  return normalizedThread;
}

export function appendVenueChatMessage(venueId, venueInfo = {}, message = {}) {
  const currentThread = getVenueChatThread(venueId, venueInfo);
  const nextMessage = sanitizeMessage(message);

  if (!nextMessage) {
    return currentThread;
  }

  return saveVenueChatThread(
    venueId,
    {
      ...currentThread,
      messages: [...currentThread.messages, nextMessage],
      unreadCount: nextMessage.sender === 'seller' ? currentThread.unreadCount + 1 : currentThread.unreadCount,
      updatedAt: nextMessage.createdAt
    },
    venueInfo
  );
}

export function markVenueChatThreadRead(venueId, venueInfo = {}) {
  const normalizedVenueId = String(venueId || '').trim();
  if (!normalizedVenueId) {
    return normalizeThread(null, venueInfo);
  }

  const currentThread = getVenueChatThread(normalizedVenueId, venueInfo);
  if (!currentThread.unreadCount) {
    return currentThread;
  }

  return saveVenueChatThread(
    normalizedVenueId,
    {
      ...currentThread,
      unreadCount: 0
    },
    venueInfo
  );
}

export function getRecentVenueChats(limit = 6) {
  const threads = Object.values(readThreads())
    .map((thread) => normalizeThread(thread))
    .filter((thread) => thread.venueId && thread.messages.length)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return threads.slice(0, Math.max(1, limit));
}

export function getTotalUnreadVenueChats() {
  return Object.values(readThreads())
    .map((thread) => normalizeThread(thread))
    .reduce((total, thread) => total + Math.max(0, Number(thread.unreadCount || 0)), 0);
}

export function subscribeVenueChatUpdates(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const handleStorage = () => callback(getRecentVenueChats(20));
  const handleCustomEvent = () => callback(getRecentVenueChats(20));

  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHAT_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHAT_EVENT, handleCustomEvent);
  };
}

const NOTIFICATION_COPY = {
  en: {
    panelAriaLabel: 'Notifications',
    closePanelAriaLabel: 'Close notifications panel',
    triggerAriaLabel: 'Notifications',
    optionsAriaLabel: 'Notification options',
    title: 'Notifications',
    unreadCount: (count) => `${count} unread`,
    allRead: 'All read',
    markAllAsRead: 'Mark all as read',
    allFilter: 'All',
    unreadFilter: 'Unread',
    sectionTitle: 'New',
    loading: 'Loading notifications...',
    fallbackTitle: 'Notification',
    fallbackContent: 'You have a new update.',
    loadMore: 'Load earlier notifications',
    loadingMore: 'Loading more...',
    emptyUnread: 'No unread notifications.',
    emptyAll: 'No notifications yet.',
    favoriteAddedTitle: 'Added to favorites',
    favoriteRemovedTitle: 'Removed from favorites',
    venueFavoriteTitle: 'Your venue received a new favorite',
    venueFavoriteContent: ({ actorName }) => `${actorName} favorited your venue.`,
    messageTitle: 'You have a new message',
    messageContent: ({ senderName, venueName }) => `${senderName} sent a message about ${venueName}.`,
    profileUpdatedTitle: 'Profile updated successfully',
    profileUpdatedContent: 'Your profile has been saved with the latest information.',
    preferencesUpdatedTitle: 'Preferences updated successfully',
    preferencesUpdatedContent: 'Your latest preferences will be used to improve venue recommendations.',
  },
  vi: {
    panelAriaLabel: 'Thông báo',
    closePanelAriaLabel: 'Đóng bảng thông báo',
    triggerAriaLabel: 'Thông báo',
    optionsAriaLabel: 'Tùy chọn thông báo',
    title: 'Thông báo',
    unreadCount: (count) => `${count} chưa đọc`,
    allRead: 'Đã đọc hết',
    markAllAsRead: 'Đánh dấu tất cả đã đọc',
    allFilter: 'Tất cả',
    unreadFilter: 'Chưa đọc',
    sectionTitle: 'Mới',
    loading: 'Đang tải thông báo...',
    fallbackTitle: 'Thông báo',
    fallbackContent: 'Bạn có một cập nhật mới.',
    loadMore: 'Tải thêm thông báo cũ',
    loadingMore: 'Đang tải thêm...',
    emptyUnread: 'Không có thông báo chưa đọc.',
    emptyAll: 'Chưa có thông báo nào.',
    favoriteAddedTitle: 'Đã thêm vào yêu thích',
    favoriteRemovedTitle: 'Đã bỏ khỏi yêu thích',
    venueFavoriteTitle: 'Bài đăng của bạn có lượt yêu thích mới',
    venueFavoriteContent: ({ actorName }) => `${actorName} đã yêu thích bài đăng của bạn.`,
    messageTitle: 'Bạn có tin nhắn mới',
    messageContent: ({ senderName, venueName }) => `${senderName} vừa gửi tin nhắn về ${venueName}.`,
    profileUpdatedTitle: 'Bạn đã cập nhật thông tin cá nhân thành công',
    profileUpdatedContent: 'Hồ sơ của bạn vừa được lưu với thông tin mới nhất.',
    preferencesUpdatedTitle: 'Bạn đã cập nhật sở thích thành công',
    preferencesUpdatedContent: 'Hệ thống sẽ dùng sở thích mới để gợi ý địa điểm phù hợp hơn.',
  },
};

const TITLE_TO_KEY = new Map([
  ['Added to favorites', 'favorite_added'],
  ['Đã thêm vào yêu thích', 'favorite_added'],
  ['Removed from favorites', 'favorite_removed'],
  ['Đã bỏ khỏi yêu thích', 'favorite_removed'],
  ['Your venue received a new favorite', 'venue_favorite'],
  ['Bài đăng của bạn có lượt yêu thích mới', 'venue_favorite'],
  ['You have a new message', 'message_new'],
  ['Bạn có tin nhắn mới', 'message_new'],
  ['Profile updated successfully', 'profile_updated'],
  ['Bạn đã cập nhật thông tin cá nhân thành công', 'profile_updated'],
  ['Preferences updated successfully', 'preferences_updated'],
  ['Bạn đã cập nhật sở thích thành công', 'preferences_updated'],
]);

function resolveNotificationLanguage(language) {
  return language === 'vi' ? 'vi' : 'en';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function parseVenueFavoriteContent(content) {
  const normalizedContent = normalizeText(content);
  if (!normalizedContent) {
    return null;
  }

  let match = normalizedContent.match(/^(.*)\s+favorited your venue\.$/i);
  if (match) {
    return { actorName: normalizeText(match[1]) || 'Someone' };
  }

  match = normalizedContent.match(/^(.*)\s+đã yêu thích bài đăng của bạn\.$/i);
  if (match) {
    return { actorName: normalizeText(match[1]) || 'Ai đó' };
  }

  return null;
}

function parseMessageContent(content) {
  const normalizedContent = normalizeText(content);
  if (!normalizedContent) {
    return null;
  }

  let match = normalizedContent.match(/^(.*)\s+sent a message about\s+(.*)\.$/i);
  if (match) {
    return {
      senderName: normalizeText(match[1]) || 'Someone',
      venueName: normalizeText(match[2]) || 'venue',
    };
  }

  match = normalizedContent.match(/^(.*)\s+vừa gửi tin nhắn về\s+(.*)\.$/i);
  if (match) {
    return {
      senderName: normalizeText(match[1]) || 'Ai đó',
      venueName: normalizeText(match[2]) || 'địa điểm',
    };
  }

  return null;
}

function resolveNotificationKey(item) {
  const source = item && typeof item === 'object' ? item : {};
  const metadata = source?.metadata && typeof source.metadata === 'object' ? source.metadata : {};
  const type = normalizeText(source?.type).toLowerCase();
  const title = normalizeText(source?.title);

  if (type === 'favorite') {
    if (metadata?.action === 'added') {
      return 'favorite_added';
    }
    if (metadata?.action === 'removed') {
      return 'favorite_removed';
    }
  }

  if (type === 'venue_favorite') {
    return 'venue_favorite';
  }

  if (type === 'general' && metadata?.threadId) {
    return 'message_new';
  }

  if (type === 'general' && metadata?.section === 'profile') {
    return 'profile_updated';
  }

  if (type === 'general' && metadata?.section === 'preferences') {
    return 'preferences_updated';
  }

  return TITLE_TO_KEY.get(title) || '';
}

export function getNotificationCopy(language) {
  return NOTIFICATION_COPY[resolveNotificationLanguage(language)];
}

export function formatNotificationTime(value, language) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(resolveNotificationLanguage(language) === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function localizeNotification(item, language) {
  const source = item && typeof item === 'object' ? item : {};
  const copy = getNotificationCopy(language);
  const key = resolveNotificationKey(source);
  const rawTitle = normalizeText(source?.title);
  const rawContent = source?.content == null ? '' : normalizeText(source.content);

  if (key === 'favorite_added') {
    return {
      ...source,
      title: copy.favoriteAddedTitle,
      content: rawContent || null,
    };
  }

  if (key === 'favorite_removed') {
    return {
      ...source,
      title: copy.favoriteRemovedTitle,
      content: rawContent || null,
    };
  }

  if (key === 'venue_favorite') {
    const params = parseVenueFavoriteContent(rawContent);
    return {
      ...source,
      title: copy.venueFavoriteTitle,
      content: params ? copy.venueFavoriteContent(params) : rawContent || null,
    };
  }

  if (key === 'message_new') {
    const params = parseMessageContent(rawContent);
    return {
      ...source,
      title: copy.messageTitle,
      content: params ? copy.messageContent(params) : rawContent || null,
    };
  }

  if (key === 'profile_updated') {
    return {
      ...source,
      title: copy.profileUpdatedTitle,
      content: copy.profileUpdatedContent,
    };
  }

  if (key === 'preferences_updated') {
    return {
      ...source,
      title: copy.preferencesUpdatedTitle,
      content: copy.preferencesUpdatedContent,
    };
  }

  return {
    ...source,
    title: rawTitle || copy.fallbackTitle,
    content: rawContent || null,
  };
}

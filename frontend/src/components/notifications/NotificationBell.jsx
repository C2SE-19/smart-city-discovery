import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchUserNotifications,
  markUserNotificationsRead,
  resolveNotificationsStreamUrl,
} from '../../services/api/notificationsApi';
import NotificationList from './NotificationList';
import './NotificationBell.css';

const INITIAL_NOTIFICATIONS_LIMIT = 5;
const NOTIFICATIONS_LOAD_MORE_STEP = 10;
const NOTIFICATIONS_MAX_LIMIT = 50;

function formatNotificationTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function resolveNotificationDestination(item) {
  const type = String(item?.type || '').trim().toLowerCase();
  const metadata = item?.metadata || {};

  // Forum notifications
  if (type === 'forum_post' || type === 'forum_comment') {
    const postId = metadata?.postId;
    const commentId = metadata?.commentId;
    
    let path = '/forum';
    if (postId) {
      const params = new URLSearchParams();
      params.set('postId', String(postId));
      if (commentId) {
        params.set('commentId', String(commentId));
      }
      path = `/forum?${params.toString()}`;
    }
    return path;
  }

  // Venue review notification - go to venue detail with review focus
  if (type === 'venue_review') {
    const venueId = metadata?.venueId;
    const reviewId = metadata?.reviewId;
    
    if (venueId) {
      const params = new URLSearchParams();
      if (reviewId) {
        params.set('reviewId', String(reviewId));
      }
      return `/venues/${String(venueId)}?${params.toString()}`;
    }
  }

  // Venue reply notification - go to venue detail with review focus
  if (type === 'venue_reply') {
    const venueId = metadata?.venueId;
    const reviewId = metadata?.reviewId;
    
    if (venueId) {
      const params = new URLSearchParams();
      if (reviewId) {
        params.set('reviewId', String(reviewId));
      }
      return `/venues/${String(venueId)}?${params.toString()}`;
    }
  }

  // Venue favorite notification - go to venue detail
  if (type === 'venue_favorite') {
    const venueId = metadata?.itemId;
    
    if (venueId) {
      return `/venues/${String(venueId)}`;
    }
  }

  // Feedback notification - go to feedback page
  if (type === 'feedback') {
    const feedbackId = metadata?.feedbackId;
    
    if (feedbackId) {
      const params = new URLSearchParams();
      params.set('feedbackId', String(feedbackId));
      return `/feedback?${params.toString()}`;
    }
    return '/feedback';
  }

  // Venue submission notification - go to merchant posts
  if (type === 'venue_submission') {
    const venueId = metadata?.venueId;
    
    if (venueId) {
      const params = new URLSearchParams();
      params.set('venueId', String(venueId));
      return `/merchant/posts?${params.toString()}`;
    }
    return '/merchant/posts';
  }

  // Chat notification - go to chat
  if (type === 'general' && metadata?.threadId) {
    const threadId = metadata?.threadId;
    const venueId = metadata?.venueId;
    
    const params = new URLSearchParams();
    if (threadId) params.set('threadId', String(threadId));
    if (venueId) params.set('venueId', String(venueId));
    
    return `/chat?${params.toString()}`;
  }

  // Profile update notification - go to profile
  if (type === 'general' && item?.title?.includes('cập nhật')) {
    return '/profile';
  }

  return '';
}

function NotificationBell() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const rootRef = useRef(null);
  const previousUnreadRef = useRef(0);
  const ringTimeoutRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [fetchLimit, setFetchLimit] = useState(INITIAL_NOTIFICATIONS_LIMIT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const applyNotificationsPayload = useCallback((payload) => {
    const nextNotifications = Array.isArray(payload?.notifications) ? payload.notifications : [];
    const nextUnreadCount = Number(payload?.unreadCount || 0);

    setNotifications(nextNotifications);
    setUnreadCount(nextUnreadCount);

    if (hasLoadedRef.current && nextUnreadCount > previousUnreadRef.current) {
      setIsRinging(true);

      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
      }

      ringTimeoutRef.current = window.setTimeout(() => {
        setIsRinging(false);
      }, 1400);
    }

    previousUnreadRef.current = nextUnreadCount;
    hasLoadedRef.current = true;
  }, []);

  const loadNotifications = useCallback(async ({ silent = false, limit = fetchLimit } = {}) => {
    if (!user || !token) {
      setNotifications([]);
      setUnreadCount(0);
      setFetchLimit(INITIAL_NOTIFICATIONS_LIMIT);
      setIsLoadingMore(false);
      previousUnreadRef.current = 0;
      hasLoadedRef.current = false;
      return;
    }

    const normalizedLimit = Math.min(
      Math.max(Number.parseInt(String(limit), 10) || INITIAL_NOTIFICATIONS_LIMIT, 1),
      NOTIFICATIONS_MAX_LIMIT
    );

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const payload = await fetchUserNotifications(normalizedLimit);
      applyNotificationsPayload(payload);
    } catch {
      if (!silent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }

      setIsLoadingMore(false);
    }
  }, [applyNotificationsPayload, fetchLimit, token, user]);

  useEffect(() => {
    if (!isOpen) {
      setShowActionsMenu(false);
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!user || !token) {
      setIsOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      setFetchLimit(INITIAL_NOTIFICATIONS_LIMIT);
      setIsLoadingMore(false);
      previousUnreadRef.current = 0;
      hasLoadedRef.current = false;
      return undefined;
    }

    let active = true;
    const streamUrl = resolveNotificationsStreamUrl(token, fetchLimit);
    const eventSource = streamUrl ? new EventSource(streamUrl) : null;

    loadNotifications({ limit: fetchLimit }).catch(() => {});

    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true, limit: fetchLimit }).catch(() => {});
    }, 30000);

    const handleWindowFocus = () => {
      loadNotifications({ silent: true, limit: fetchLimit }).catch(() => {});
    };

    window.addEventListener('focus', handleWindowFocus);

    if (eventSource) {
      const handleNotificationsEvent = (event) => {
        if (!active) {
          return;
        }

        try {
          const payload = JSON.parse(event.data || '{}');
          applyNotificationsPayload(payload);
        } catch {
          // Ignore malformed realtime payloads.
        }
      };

      eventSource.addEventListener('notifications', handleNotificationsEvent);
      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
        }
      };

      return () => {
        active = false;
        window.clearInterval(intervalId);
        window.removeEventListener('focus', handleWindowFocus);
        eventSource.removeEventListener('notifications', handleNotificationsEvent);
        eventSource.close();
      };
    }

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [applyNotificationsPayload, fetchLimit, loadNotifications, token, user]);

  useEffect(() => {
    const handleManualRefresh = () => {
      loadNotifications({ silent: true, limit: fetchLimit }).catch(() => {});
    };

    window.addEventListener('smart-city-notification-refresh', handleManualRefresh);

    return () => {
      window.removeEventListener('smart-city-notification-refresh', handleManualRefresh);
    };
  }, [fetchLimit, loadNotifications]);

  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) {
        window.clearTimeout(ringTimeoutRef.current);
      }
    };
  }, []);

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return '';
    }

    return unreadCount > 99 ? '99+' : String(unreadCount);
  }, [unreadCount]);

  const updateLocalReadState = (ids = []) => {
    const idSet = new Set(ids.map((value) => Number(value)).filter((value) => Number.isFinite(value)));

    setNotifications((current) =>
      current.map((item) =>
        idSet.has(Number(item?.id))
          ? {
              ...item,
              isRead: true,
              readAt: item?.readAt || new Date().toISOString(),
            }
          : item
      )
    );

    setUnreadCount((current) => Math.max(0, current - idSet.size));
    previousUnreadRef.current = Math.max(0, previousUnreadRef.current - idSet.size);
  };

  const handleNotificationClick = async (item) => {
    const itemId = Number(item?.id);

    if (Number.isFinite(itemId) && !item?.isRead) {
      try {
        await markUserNotificationsRead([itemId]);
        updateLocalReadState([itemId]);
      } catch {
        await loadNotifications({ silent: true });
      }
    }

    const destination = resolveNotificationDestination(item);
    if (destination) {
      navigate(destination);
      setIsOpen(false);
      setShowActionsMenu(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount <= 0) {
      setShowActionsMenu(false);
      return;
    }

    try {
      await markUserNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item?.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
      previousUnreadRef.current = 0;
    } catch {
      await loadNotifications({ silent: true });
    } finally {
      setShowActionsMenu(false);
    }
  };

  const canLoadMore = notifications.length >= fetchLimit && fetchLimit < NOTIFICATIONS_MAX_LIMIT;

  const handleLoadMore = async () => {
    if (isLoadingMore || !canLoadMore) {
      return;
    }

    const nextLimit = Math.min(fetchLimit + NOTIFICATIONS_LOAD_MORE_STEP, NOTIFICATIONS_MAX_LIMIT);
    setIsLoadingMore(true);
    setFetchLimit(nextLimit);
    await loadNotifications({ silent: true, limit: nextLimit });
  };

  return (
    <div className="notification-bell" ref={rootRef}>
      {isOpen && user ? (
        <button
          type="button"
          className="notification-bell__backdrop"
          aria-label="Đóng bảng thông báo"
          onClick={() => {
            setIsOpen(false);
            setShowActionsMenu(false);
          }}
        />
      ) : null}

      <button
        type="button"
        className={`notification-bell__trigger ${isRinging ? 'is-ringing' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
        aria-label="Thông báo"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          if (!user) {
            navigate('/login');
            return;
          }

          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          setShowActionsMenu(false);

          if (nextOpen) {
            loadNotifications({ silent: true, limit: fetchLimit }).catch(() => {});
          }
        }}
      >
        <FiBell />
        {badgeLabel ? <span className="notification-bell__badge">{badgeLabel}</span> : null}
      </button>

      {isOpen && user ? (
        <NotificationList
          notifications={notifications}
          unreadCount={unreadCount}
          activeFilter={activeFilter}
          isLoading={isLoading}
          showActionsMenu={showActionsMenu}
          onFilterChange={setActiveFilter}
          onItemClick={handleNotificationClick}
          onToggleActionsMenu={() => setShowActionsMenu((current) => !current)}
          onMarkAllRead={handleMarkAllRead}
          formatTimestamp={formatNotificationTime}
          hasMore={canLoadMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      ) : null}
    </div>
  );
}

export default NotificationBell;

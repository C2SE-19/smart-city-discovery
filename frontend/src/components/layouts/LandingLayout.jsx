import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import { deleteChatThread, fetchChatThreads, fetchVenueChatThread, markChatThreadRead, sendVenueChatMessage } from '../../services/api/chatApi';
import logo from '../../assets/images/logo.png';
import NotificationBell from '../notifications/NotificationBell';
import './LandingLayout.css';
import { MdExpandMore } from 'react-icons/md';

const paymentMethods = ['VISA', 'KHEO', 'PayPal'];
const CHAT_PREFS_STORAGE_KEY = 'chat_menu_prefs';
const CHAT_DELETE_SYNC_KEY = 'chat_thread_deleted_sync';
const ACTIVE_CHAT_THREAD_SYNC_KEY = 'active_chat_thread_sync';

function resolveThreadGroupKey(thread) {
  const ownerUserId = String(thread?.ownerUserId || '').trim();
  const customerUserId = String(thread?.customerUserId || '').trim();
  return `${ownerUserId}::${customerUserId}`;
}

function resolveThreadTimestamp(thread) {
  const candidate =
    thread?.lastMessage?.createdAt ||
    thread?.lastMessageAt ||
    thread?.updatedAt ||
    thread?.createdAt ||
    '';
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeRecentThreads(threads) {
  const groupedThreads = new Map();

  (Array.isArray(threads) ? threads : []).forEach((thread) => {
    const key = resolveThreadGroupKey(thread) || String(thread?.id || '');
    if (!key) {
      return;
    }

    const previous = groupedThreads.get(key);
    if (!previous) {
      groupedThreads.set(key, {
        ...thread,
        childThreadIds: thread?.id ? [String(thread.id)] : []
      });
      return;
    }

    const previousTimestamp = resolveThreadTimestamp(previous);
    const nextTimestamp = resolveThreadTimestamp(thread);
    const latestThread = nextTimestamp >= previousTimestamp ? thread : previous;

    groupedThreads.set(key, {
      ...previous,
      ...latestThread,
      unreadCount: Number(previous?.unreadCount || 0) + Number(thread?.unreadCount || 0),
      childThreadIds: Array.from(new Set([...(previous?.childThreadIds || []), ...(thread?.id ? [String(thread.id)] : [])]))
    });
  });

  return Array.from(groupedThreads.values()).sort((left, right) => resolveThreadTimestamp(right) - resolveThreadTimestamp(left));
}

function loadChatPrefs() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHAT_PREFS_STORAGE_KEY) || '{}');
    return {
      pinnedKeys: Array.isArray(parsed?.pinnedKeys) ? parsed.pinnedKeys.map((item) => String(item)) : [],
      hiddenKeys: [],
      reportedKeys: Array.isArray(parsed?.reportedKeys) ? parsed.reportedKeys.map((item) => String(item)) : []
    };
  } catch {
    return { pinnedKeys: [], hiddenKeys: [], reportedKeys: [] };
  }
}

function saveChatPrefs(nextPrefs) {
  window.localStorage.setItem(CHAT_PREFS_STORAGE_KEY, JSON.stringify(nextPrefs));
}

function applyChatPrefs(threads, prefs) {
  const pinnedSet = new Set(prefs?.pinnedKeys || []);

  return (Array.isArray(threads) ? threads : []).sort((left, right) => {
    const leftPinned = pinnedSet.has(resolveThreadGroupKey(left));
    const rightPinned = pinnedSet.has(resolveThreadGroupKey(right));
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }
    return resolveThreadTimestamp(right) - resolveThreadTimestamp(left);
  });
}

function clearUnreadForGroup(threads, targetGroupKey) {
  return (Array.isArray(threads) ? threads : []).map((thread) =>
    resolveThreadGroupKey(thread) === targetGroupKey
      ? { ...thread, unreadCount: 0 }
      : thread
  );
}

function resolveMessageContextLine(message) {
  const venueName = String(message?.venueName || '').trim();
  const venueAddress = String(message?.venueAddress || '').trim();
  const contextLabel = String(message?.contextLabel || '').trim();

  if (venueName) {
    return `Về quán: ${venueName}${venueAddress ? ` · ${venueAddress}` : ''}`;
  }

  if (contextLabel) {
    return `Chủ đề: ${contextLabel}`;
  }

  return '';
}

function LandingLayout() {
  const { language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const t = translations[language];
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
  const [chatPrefs, setChatPrefs] = useState(() => loadChatPrefs());
  const [openChatActionsKey, setOpenChatActionsKey] = useState('');
  const [openChatActionsThread, setOpenChatActionsThread] = useState(null);
  const [chatActionsPosition, setChatActionsPosition] = useState({ top: 0, left: 0 });
  const [showGlobalChatWidget, setShowGlobalChatWidget] = useState(false);
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [globalChatMessages, setGlobalChatMessages] = useState([]);
  const [globalChatInput, setGlobalChatInput] = useState('');
  const [globalChatLoading, setGlobalChatLoading] = useState(false);
  const [globalChatSending, setGlobalChatSending] = useState(false);
  const [globalChatError, setGlobalChatError] = useState('');
  const [globalChatVenueContext, setGlobalChatVenueContext] = useState(null);
  const [globalChatContextOptions, setGlobalChatContextOptions] = useState([]);
  const [selectedGlobalChatContextValue, setSelectedGlobalChatContextValue] = useState('');
  const chatMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const chatActionsMenuRef = useRef(null);
  const globalChatListRef = useRef(null);
  const avatarUrl = user?.avatarUrl || user?.avatar_url || '';

  const refreshRecentChats = async () => {
    const threads = await fetchChatThreads(6, token);
    const mergedThreads = applyChatPrefs(mergeRecentThreads(threads), chatPrefs);
    syncRecentChatsState(mergedThreads);
    return mergedThreads;
  };

  const syncRecentChatsState = (threads) => {
    setRecentChats(threads);
    setTotalUnreadChats((Array.isArray(threads) ? threads : []).reduce((sum, thread) => sum + Number(thread?.unreadCount || 0), 0));
  };

  const handleToggleChatActions = (event, thread) => {
    event.stopPropagation();
    const groupKey = resolveThreadGroupKey(thread);
    if (!groupKey) {
      return;
    }

    if (openChatActionsKey === groupKey) {
      setOpenChatActionsKey('');
      setOpenChatActionsThread(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 170;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    setChatActionsPosition({
      top: Math.max(12, Math.min(rect.top - 4, viewportHeight - menuHeight - 12)),
      left: Math.max(12, Math.min(rect.right + 18, viewportWidth - menuWidth - 12))
    });
    setOpenChatActionsKey(groupKey);
    setOpenChatActionsThread(thread);
  };

  useEffect(() => {
    if (!openChatActionsKey) {
      return undefined;
    }

    const handleWindowInteraction = () => {
      setOpenChatActionsKey('');
      setOpenChatActionsThread(null);
    };

    window.addEventListener('scroll', handleWindowInteraction, true);
    window.addEventListener('resize', handleWindowInteraction);

    return () => {
      window.removeEventListener('scroll', handleWindowInteraction, true);
      window.removeEventListener('resize', handleWindowInteraction);
    };
  }, [openChatActionsKey]);

  useEffect(() => {
    if (!showProfileMenu && !showChatMenu && !openChatActionsKey) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      const target = event.target;

      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }

      const clickedInsideChatMenu = chatMenuRef.current && chatMenuRef.current.contains(target);
      const clickedInsideChatActions = chatActionsMenuRef.current && chatActionsMenuRef.current.contains(target);

      if ((showChatMenu || openChatActionsKey) && !clickedInsideChatMenu && !clickedInsideChatActions) {
        setShowChatMenu(false);
        setOpenChatActionsKey('');
        setOpenChatActionsThread(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu, showChatMenu, openChatActionsKey]);

  useEffect(() => {
    const handleChatRead = () => {
      refreshRecentChats().catch(() => {});
    };

    const handleChatDeleted = (event) => {
      const deletedThreadIds = new Set(
        (Array.isArray(event?.detail?.deletedThreadIds) ? event.detail.deletedThreadIds : []).map((value) => String(value))
      );

      if (deletedThreadIds.size) {
        const nextThreads = recentChats.filter((thread) => {
          const childIds = Array.isArray(thread?.childThreadIds) ? thread.childThreadIds.map((value) => String(value)) : [];
          const threadId = String(thread?.id || '');
          return !deletedThreadIds.has(threadId) && !childIds.some((value) => deletedThreadIds.has(value));
        });
        syncRecentChatsState(nextThreads);
      } else {
        refreshRecentChats().catch(() => {});
      }

      if (activeChatThread) {
        const activeIds = new Set(
          [
            String(activeChatThread?.id || ''),
            ...(Array.isArray(activeChatThread?.childThreadIds) ? activeChatThread.childThreadIds.map((value) => String(value)) : [])
          ].filter(Boolean)
        );

        const shouldClose = Array.from(activeIds).some((value) => deletedThreadIds.has(value));
        if (shouldClose) {
          setShowGlobalChatWidget(false);
          setActiveChatThread(null);
          setGlobalChatMessages([]);
          setGlobalChatInput('');
          setGlobalChatError('');
          setGlobalChatVenueContext(null);
        }
      }
    };

    window.addEventListener('chat-threads-read', handleChatRead);
    window.addEventListener('chat-thread-deleted', handleChatDeleted);

    return () => {
      window.removeEventListener('chat-threads-read', handleChatRead);
      window.removeEventListener('chat-thread-deleted', handleChatDeleted);
    };
  }, [recentChats, activeChatThread, chatPrefs, token]);

  useEffect(() => {
    if (!user) {
      setRecentChats([]);
      setTotalUnreadChats(0);
      return undefined;
    }

    let active = true;

    const loadThreads = async () => {
      try {
        const threads = await fetchChatThreads(6, token);
        if (!active) {
          return;
        }

        const mergedThreads = applyChatPrefs(mergeRecentThreads(threads), chatPrefs);
        syncRecentChatsState(mergedThreads);
      } catch {
        if (active) {
          syncRecentChatsState([]);
        }
      }
    };

    loadThreads();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      loadThreads();
    }, 20000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user, token, chatPrefs]);

  useEffect(() => {
    if (!user || !token || !showChatMenu) {
      return undefined;
    }

    refreshRecentChats().catch(() => {});
    return undefined;
  }, [showChatMenu, user, token, chatPrefs]);

  useEffect(() => {
    if (!user || !token) {
      return undefined;
    }

    const handleWindowFocus = () => {
      refreshRecentChats().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshRecentChats().catch(() => {});
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, token, chatPrefs]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowProfileMenu(false);
  };

  const handleHomeClick = (event) => {
    event.preventDefault();
    navigate(APP_ROUTES.HOME, { state: { resetOverview: Date.now() } });
    setShowProfileMenu(false);
  };

  const handleOpenChatThread = async (thread) => {
    setShowChatMenu(false);
    if (!thread?.venueId) {
      return;
    }

    const groupKey = resolveThreadGroupKey(thread);

    const threadIds = Array.isArray(thread?.childThreadIds) && thread.childThreadIds.length
      ? thread.childThreadIds
      : thread?.id
        ? [String(thread.id)]
        : [];

    if (threadIds.length) {
      const markReadResults = await Promise.all(threadIds.map((threadId) => markChatThreadRead(threadId, token).catch(() => null)));
      window.dispatchEvent(
        new CustomEvent('chat-threads-read', {
          detail: {
            threadIds: Array.from(
              new Set(
                markReadResults.flatMap((result) => (Array.isArray(result?.threadIds) ? result.threadIds : result?.threadId ? [result.threadId] : []))
              )
            )
          }
        })
      );
    }

    if (groupKey) {
      const nextThreads = clearUnreadForGroup(recentChats, groupKey);
      syncRecentChatsState(nextThreads);
    }

    setActiveChatThread(thread);
    setShowGlobalChatWidget(true);
    setGlobalChatError('');
    window.localStorage.setItem(
      ACTIVE_CHAT_THREAD_SYNC_KEY,
      JSON.stringify({
        threadId: thread?.id || null,
        venueId: thread?.venueId || null,
        ownerUserId: thread?.ownerUserId || '',
        customerUserId: thread?.customerUserId || '',
        timestamp: Date.now()
      })
    );
    window.dispatchEvent(
      new CustomEvent('active-chat-thread-changed', {
        detail: {
          threadId: thread?.id || null,
          venueId: thread?.venueId || null,
          ownerUserId: thread?.ownerUserId || '',
          customerUserId: thread?.customerUserId || ''
        }
      })
    );
    await refreshRecentChats().catch(() => {});
  };

  const handleTogglePinChat = (thread) => {
    const groupKey = resolveThreadGroupKey(thread);
    if (!groupKey) {
      return;
    }

    setChatPrefs((prev) => {
      const pinnedSet = new Set(prev.pinnedKeys || []);
      if (pinnedSet.has(groupKey)) {
        pinnedSet.delete(groupKey);
      } else {
        pinnedSet.add(groupKey);
      }
      const nextPrefs = { ...prev, pinnedKeys: Array.from(pinnedSet) };
      saveChatPrefs(nextPrefs);
      return nextPrefs;
    });
    setOpenChatActionsKey('');
    setOpenChatActionsThread(null);
  };

  const handleHideChat = async (thread) => {
    const groupKey = resolveThreadGroupKey(thread);
    const threadId = thread?.id;
    if (!groupKey || !threadId || !token) {
      return;
    }

    try {
      const response = await deleteChatThread(threadId, token);
      const deletedThreadIds = Array.isArray(response?.deletedThreadIds) ? response.deletedThreadIds : [];

      setChatPrefs((prev) => {
        const hiddenSet = new Set(prev.hiddenKeys || []);
        hiddenSet.delete(groupKey);
        const reportedSet = new Set(prev.reportedKeys || []);
        reportedSet.delete(groupKey);
        const pinnedSet = new Set(prev.pinnedKeys || []);
        pinnedSet.delete(groupKey);
        const nextPrefs = {
          ...prev,
          hiddenKeys: Array.from(hiddenSet),
          pinnedKeys: Array.from(pinnedSet),
          reportedKeys: Array.from(reportedSet)
        };
        saveChatPrefs(nextPrefs);
        return nextPrefs;
      });

      const nextThreads = recentChats.filter((item) => resolveThreadGroupKey(item) !== groupKey);
      syncRecentChatsState(nextThreads);

      window.dispatchEvent(
        new CustomEvent('chat-thread-deleted', {
          detail: {
            deletedThreadIds,
            groupKey,
            venueId: thread?.venueId || null,
            ownerUserId: thread?.ownerUserId || '',
            customerUserId: thread?.customerUserId || ''
          }
        })
      );
      window.localStorage.setItem(
        CHAT_DELETE_SYNC_KEY,
        JSON.stringify({
          deletedThreadIds,
          groupKey,
          venueId: thread?.venueId || null,
          ownerUserId: thread?.ownerUserId || '',
          customerUserId: thread?.customerUserId || '',
          timestamp: Date.now()
        })
      );

      await refreshRecentChats().catch(() => {});
    } catch (error) {
      window.alert(error?.response?.data?.message || 'KhÃ´ng thá»ƒ xÃ³a Ä‘oáº¡n chat nÃ y.');
    }

    setOpenChatActionsKey('');
    setOpenChatActionsThread(null);
  };

  const handleReportChat = (thread) => {
    const groupKey = resolveThreadGroupKey(thread);
    if (!groupKey) {
      return;
    }

    setChatPrefs((prev) => {
      const reportedSet = new Set(prev.reportedKeys || []);
      reportedSet.add(groupKey);
      const nextPrefs = { ...prev, reportedKeys: Array.from(reportedSet) };
      saveChatPrefs(nextPrefs);
      return nextPrefs;
    });
    window.alert('Đã ghi nhận báo cáo đoạn chat này.');
    setOpenChatActionsKey('');
    setOpenChatActionsThread(null);
  };

  useEffect(() => {
    if (!showGlobalChatWidget || !activeChatThread?.venueId || !token) {
      return;
    }

    let active = true;

    const loadThread = async (showLoader = true) => {
      if (showLoader) {
        setGlobalChatLoading(true);
      }

      try {
        const data = await fetchVenueChatThread(
          activeChatThread.venueId,
          activeChatThread.id ? { threadId: activeChatThread.id } : {},
          token
        );

        if (!active) {
          return;
        }

        const nextThread = data?.thread || null;
        const nextContextOptions = Array.isArray(data?.contextOptions) ? data.contextOptions : [];
        setGlobalChatVenueContext(data?.venueContext || null);
        setGlobalChatContextOptions(nextContextOptions);
        setSelectedGlobalChatContextValue((prev) => {
          if (prev && (prev === 'other' || nextContextOptions.some((option) => String(option?.id || '') === prev))) {
            return prev;
          }
          const currentVenueOption = nextContextOptions.find(
            (option) => String(option?.id || '') === String(activeChatThread?.venueId || '')
          );
          if (currentVenueOption) {
            return String(currentVenueOption.id);
          }
          return 'other';
        });
        setGlobalChatMessages(Array.isArray(nextThread?.messages) ? nextThread.messages : []);
        setActiveChatThread((prev) => ({
          ...(prev || {}),
          ...(nextThread || {}),
          venueId: activeChatThread.venueId,
          venueName: data?.venueContext?.name || prev?.venueName || activeChatThread.venueName || '',
          venueAddress: data?.venueContext?.address || prev?.venueAddress || activeChatThread.venueAddress || '',
          venueImage: data?.venueContext?.coverImageUrl || prev?.venueImage || activeChatThread.venueImage || ''
        }));
        setGlobalChatError('');

        const threadIdsToMark = Array.isArray(activeChatThread?.childThreadIds) && activeChatThread.childThreadIds.length
          ? activeChatThread.childThreadIds
          : nextThread?.id
            ? [String(nextThread.id)]
            : [];

        if (threadIdsToMark.length) {
          const markReadResults = await Promise.all(threadIdsToMark.map((threadId) => markChatThreadRead(threadId, token).catch(() => null)));
          window.dispatchEvent(
            new CustomEvent('chat-threads-read', {
              detail: {
                threadIds: Array.from(
                  new Set(
                    markReadResults.flatMap((result) => (Array.isArray(result?.threadIds) ? result.threadIds : result?.threadId ? [result.threadId] : []))
                  )
                )
              }
            })
          );
          await refreshRecentChats().catch(() => {});
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setGlobalChatError(error?.response?.data?.message || 'Không thể tải hội thoại.');
        setGlobalChatMessages([]);
      } finally {
        if (active && showLoader) {
          setGlobalChatLoading(false);
        }
      }
    };

    loadThread(true);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      loadThread(false);
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [showGlobalChatWidget, activeChatThread?.id, activeChatThread?.venueId, token]);

  useEffect(() => {
    if (!globalChatListRef.current) {
      return;
    }

    globalChatListRef.current.scrollTop = globalChatListRef.current.scrollHeight;
  }, [globalChatMessages]);

  const handleSendGlobalChatMessage = async (event) => {
    event.preventDefault();

    const normalizedMessage = globalChatInput.trim();
    if (!normalizedMessage || !activeChatThread?.venueId || !token) {
      return;
    }

    setGlobalChatSending(true);
    setGlobalChatError('');

    try {
      const response = await sendVenueChatMessage(
        activeChatThread.venueId,
        {
          content: normalizedMessage,
          threadId: activeChatThread.id || undefined,
          contextVenueId:
            selectedGlobalChatContextValue && selectedGlobalChatContextValue !== 'other'
              ? Number(selectedGlobalChatContextValue)
              : undefined,
          contextLabel: selectedGlobalChatContextValue === 'other' ? 'Other' : undefined
        },
        token
      );

      const nextThread = response?.thread || null;
      setGlobalChatInput('');
      setGlobalChatMessages(Array.isArray(nextThread?.messages) ? nextThread.messages : []);
      setActiveChatThread((prev) => ({
        ...(prev || {}),
        ...(nextThread || {}),
        venueId: activeChatThread.venueId
      }));

      const threadIdsToMark = Array.isArray(activeChatThread?.childThreadIds) && activeChatThread.childThreadIds.length
        ? activeChatThread.childThreadIds
        : nextThread?.id
          ? [String(nextThread.id)]
          : [];

      if (threadIdsToMark.length) {
        const markReadResults = await Promise.all(threadIdsToMark.map((threadId) => markChatThreadRead(threadId, token).catch(() => null)));
        window.dispatchEvent(
          new CustomEvent('chat-threads-read', {
            detail: {
              threadIds: Array.from(
                new Set(
                  markReadResults.flatMap((result) => (Array.isArray(result?.threadIds) ? result.threadIds : result?.threadId ? [result.threadId] : []))
                )
              )
            }
          })
        );
      }
      await refreshRecentChats().catch(() => {});
    } catch (error) {
      setGlobalChatError(error?.response?.data?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setGlobalChatSending(false);
    }
  };

  const handleBackToChatList = () => {
    setShowGlobalChatWidget(false);
    setShowChatMenu(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="landing-shell">
      <div className="landing-page">
        <header className="landing-header">
          <Link
            to="/"
            className="landing-logo"
            aria-label="Smart City homepage"
            onClick={handleHomeClick}
            data-onboarding="landing-logo"
          >
            <span className="landing-logo-mark">
              <img src={logo} alt="Smart City Logo" className="landing-logo-image" />
            </span>
            <span className="landing-logo-copy">
              <strong>Smart City</strong>
              <span>Discovery</span>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="Primary" data-onboarding="landing-nav">
            <NavLink
              to="/"
              end
              onClick={handleHomeClick}
              className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}
            >
              {t.header.home}
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}
            >
              {t.header.about}
            </NavLink>
            <NavLink
              to="/all-city"
              className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}
            >
              {t.header.allCity}
            </NavLink>
            <NavLink
              to="/service"
              className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}
            >
              {t.header.service}
            </NavLink>
            <NavLink
              to={APP_ROUTES.FORUM}
              className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}
            >
              {t.header.forum}
            </NavLink>
          </nav>

          <div className="landing-header-actions">
            <button
              type="button"
              className="landing-onboarding-trigger"
              aria-label="Mở lại hướng dẫn"
              title="Mở lại hướng dẫn"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('smart-city-onboarding-restart'));
              }}
            >
              ?
            </button>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="landing-language-select"
              aria-label="Select language"
            >
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
            </select>
            <NotificationBell />
              <div className="landing-chat-menu" ref={chatMenuRef}>
              <button
                type="button"
                className="landing-chat-trigger"
                aria-label="Messages"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowChatMenu((current) => {
                    if (current) {
                      setOpenChatActionsKey('');
                      setOpenChatActionsThread(null);
                    }
                    return !current;
                  });
                }}
              >
                💬
                {totalUnreadChats > 0 ? (
                  <span className="landing-chat-badge">{totalUnreadChats > 99 ? '99+' : totalUnreadChats}</span>
                ) : null}
              </button>

              {showChatMenu ? (
                <div className="landing-chat-dropdown">
                  <div className="landing-chat-dropdown-header">
                    <strong>Messages</strong>
                    <span>{recentChats.length}</span>
                  </div>

                  {!recentChats.length ? (
                    <p className="landing-chat-empty">No chat threads.</p>
                  ) : (
                    <div className="landing-chat-list">
                      {recentChats.map((thread) => {
                        const lastMessage = thread.lastMessage || thread.messages?.[thread.messages.length - 1];
                        return (
                          <div className="landing-chat-item-shell" key={`header-chat-${thread.id || thread.venueId}`}>
                          <button
                            type="button"
                            className="landing-chat-item"
                            onClick={() => handleOpenChatThread(thread)}
                          >
                            <img src={thread.venueImage || logo} alt={thread.venueName} loading="lazy" />
                            <div className="landing-chat-item-body">
                              <strong>
                                {thread.ownerName || 'Venue Owner'}
                                {thread.unreadCount > 0 ? <em>{thread.unreadCount}</em> : null}
                              </strong>
                              <p>{thread.venueName}</p>
                              <span>{lastMessage?.content || 'No content'}</span>
                            </div>
                          </button>
                          <div className="landing-chat-item-actions">
                            <button
                              type="button"
                              className="landing-chat-item-menu-trigger"
                              aria-label="Tùy chọn chat"
                              onClick={(event) => handleToggleChatActions(event, thread)}
                            >
                              ⋯
                            </button>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {openChatActionsKey && openChatActionsThread ? (
                    <div
                      ref={chatActionsMenuRef}
                      className="landing-chat-item-menu landing-chat-item-menu-floating"
                      style={{ top: `${chatActionsPosition.top}px`, left: `${chatActionsPosition.left}px` }}
                    >
                      <button type="button" onClick={() => handleTogglePinChat(openChatActionsThread)}>
                        {(chatPrefs?.pinnedKeys || []).includes(resolveThreadGroupKey(openChatActionsThread)) ? 'Unpin' : 'Pin message'}
                      </button>
                      <button type="button" onClick={() => handleHideChat(openChatActionsThread)}>
                        Remove from list
                      </button>
                     
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            
            {!user ? (
              <Link to="/login" className="landing-login" data-onboarding="landing-login">
                {t.header.login}
              </Link>
            ) : (
              <div className="landing-profile-menu" ref={profileMenuRef} data-onboarding="landing-profile">
                <button 
                  type="button" 
                  className="landing-profile-button"
                  onClick={() => {
                    setShowChatMenu(false);
                    setOpenChatActionsKey('');
                    setOpenChatActionsThread(null);
                    setShowProfileMenu((current) => !current);
                  }}
                  aria-label="Profile menu"
                >
                  <div className="landing-profile-avatar">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.fullname || user.username || 'User avatar'}
                        className="landing-avatar-image"
                      />
                    ) : (
                      <div className="landing-avatar-initial">
                        {user.fullname?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <MdExpandMore className="landing-profile-arrow" />
                </button>

                {showProfileMenu && (
                  <div className="landing-profile-dropdown">
                    <div className="landing-dropdown-header">
                      {t.profile.hello}, {user.fullname || user.username}
                    </div>
                    <button 
                      type="button" 
                      className="landing-dropdown-item"
                      onClick={() => {
                        navigate('/profile');
                        setShowProfileMenu(false);
                      }}
                    >
                      {t.profile.accountInfo}
                    </button>
                    <button 
                      type="button" 
                      className="landing-dropdown-item"
                      onClick={() => {
                        navigate('/merchant/posts');
                        setShowProfileMenu(false);
                      }}
                    >
                      {t.profile.managePost}
                    </button>
                    <button 
                      type="button" 
                      className="landing-dropdown-item"
                      onClick={() => {
                        navigate(APP_ROUTES.FEEDBACK);
                        setShowProfileMenu(false);
                      }}
                    >
                      {t.profile.feedback}
                    </button>
                    <button 
                      type="button" 
                      className="landing-dropdown-item"
                      onClick={() => {
                        navigate(APP_ROUTES.TERMS);
                        setShowProfileMenu(false);
                      }}
                    >
                      {t.profile.terms}
                    </button>
                    <button 
                      type="button" 
                      className="landing-dropdown-logout"
                      onClick={handleLogout}
                    >
                      {t.profile.logout}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className={`landing-theme-toggle ${theme}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <span className="landing-theme-icon">
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
            </button>
          </div>
        </header>

        <main className="landing-main">
          <Outlet />
        </main>

        {showGlobalChatWidget && activeChatThread ? (
          <div className="landing-global-chat-widget">
            <div className="landing-global-chat-header">
              <div className="landing-global-chat-header-left">
                <button
                  type="button"
                  className="landing-global-chat-back"
                  onClick={handleBackToChatList}
                  aria-label="Back to chat list"
                >
                  ←
                </button>
                <div className="landing-global-chat-brand">
                  <div className="landing-global-chat-avatar">
                    <img src={activeChatThread.venueImage || logo} alt={activeChatThread.venueName || 'Chat venue'} loading="lazy" />
                  </div>
                  <div>
                    <strong>{activeChatThread.ownerName || 'Chá»§ quÃ¡n'}</strong>
                    <p>{activeChatThread.venueName || globalChatVenueContext?.name || 'Äoáº¡n chat'}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="landing-global-chat-minimize"
                onClick={() => setShowGlobalChatWidget(false)}
                aria-label="Minimize chat"
              >
                x
              </button>
            </div>

            <div className="landing-global-chat-body">
              <div className="landing-global-chat-intro">
                <p className="landing-global-chat-intro-title">Venue information</p>
                <p><strong>{globalChatVenueContext?.name || activeChatThread.venueName || 'No venue name'}</strong></p>
                <p>{globalChatVenueContext?.address || activeChatThread.venueAddress || 'No address'}</p>
              </div>

              <div className="landing-global-chat-messages" ref={globalChatListRef}>
                {globalChatLoading ? (
                  <div className="landing-global-chat-empty"><p>Loading messages...</p></div>
                ) : globalChatError ? (
                  <div className="landing-global-chat-empty"><p>{globalChatError}</p></div>
                ) : globalChatMessages.length ? (
                  globalChatMessages.map((message) => {
                    const contextLine = resolveMessageContextLine(message);

                    return (
                      <article
                        key={message.id}
                        className={`landing-global-chat-bubble ${message.sender === 'seller' ? 'is-seller' : 'is-customer'}`}
                      >
                        <header>
                          <strong>{message.author}</strong>
                          <span>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </header>
                        {contextLine ? <p className="landing-global-chat-context">{contextLine}</p> : null}
                        <p>{message.content}</p>
                      </article>
                    );
                  })
                ) : (
                  <div className="landing-global-chat-empty"><p>No messages yet.</p></div>
                )}
              </div>

              <form className="landing-global-chat-form" onSubmit={handleSendGlobalChatMessage}>
                <textarea
                  rows="3"
                  value={globalChatInput}
                  onChange={(event) => setGlobalChatInput(event.target.value)}
                  placeholder="Type a message..."
                />
                <div className="landing-global-chat-form-footer">
                  <span>{globalChatMessages.length} messages</span>
                  <select
                    className="landing-global-chat-context-select"
                    value={selectedGlobalChatContextValue}
                    onChange={(event) => setSelectedGlobalChatContextValue(event.target.value)}
                    disabled={globalChatSending || globalChatLoading}
                  >
                    {globalChatContextOptions.map((option) => (
                      <option key={`global-chat-context-${option.id}`} value={String(option.id)}>
                        {option.name}
                      </option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                  <button type="submit" disabled={globalChatSending || !globalChatInput.trim()}>
                    {globalChatSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-block">
            <h3>SmartCity</h3>
            <p>Accepted Payment</p>
            <div className="landing-payment-row">
              {paymentMethods.map((method) => (
                <span key={method} className="landing-payment-badge">
                  {method}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-footer-block">
            <h3>Contact</h3>
            <div className="landing-social-row">
              <a href="#!" aria-label="Facebook" />
              <a href="#!" aria-label="Messenger" />
              <a href="#!" aria-label="Instagram" />
            </div>
          </div>

          <div className="landing-footer-block">
            <h3>Support</h3>
            <a href="#!">FAQ</a>
            <a href="#!">Contact</a>
          </div>

          <div className="landing-footer-block">
            <h3>Location</h3>
            <p>384, 2/9 Street, Da Nang</p>
          </div>
        </div>

        <p className="landing-footer-note">Powered by SmartCity</p>
      </footer>
    </div>
  );
}

export default LandingLayout;

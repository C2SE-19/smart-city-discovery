import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { APP_ROUTES } from '../../constants/routes';
import translations from '../../constants/translations';
import { fetchAdminVenues, fetchAdminVenueUpdateRequests } from '../../services/api/adminMapApi';
import { fetchAdminForumPosts } from '../../services/api/adminForumApi';
import { fetchAdminFeedbackReports } from '../../services/api/adminFeedbackApi';
import { fetchAdminRevenueReport } from '../../services/api/adPackagesApi';
import './AdminLayout.css';

const BADGE_REFRESH_MS = 4000;
const BADGE_REFRESH_EVENT = 'admin-badges-refresh';
const REPORTS_LAST_SEEN_KEY = 'adminReportsLastSeen';
const REFRESH_DEBOUNCE_MS = 250;

function NavGlyph({ type }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="11" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="17" width="7" height="4" rx="2" />
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M4 18a5 5 0 0 1 10 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15 18a4 4 0 0 1 5 0" />
      </svg>
    ),
    map: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20Z" />
        <path d="M9 4v13.5" />
        <path d="M15 6.5V20" />
      </svg>
    ),
    forum: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
        <path d="M8 8h8" />
        <path d="M8 11h6" />
      </svg>
    ),
    payments: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18" />
        <path d="M8 15h3" />
      </svg>
    ),
    packages: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4 7l8 4 8-4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
    feedback: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
      </svg>
    ),
  };

  return icons[type] ?? icons.dashboard;
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getTime();
}

function AdminLayout() {
  const { user, logout } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const t = translations[language]?.admin || translations.en.admin;
  const [badgeCounts, setBadgeCounts] = useState({ map: 0, forum: 0, reports: 0, feedback: 0 });
  const adminNavigation = useMemo(
    () => [
      { label: t.navigation.dashboard, path: APP_ROUTES.ADMIN_DASHBOARD, icon: 'dashboard' },
      { label: t.navigation.users, path: APP_ROUTES.ADMIN_USERS, icon: 'users' },
      {
        label: t.navigation.map,
        path: APP_ROUTES.ADMIN_BOUNDARIES,
        icon: 'map',
        badgeCount: badgeCounts.map,
      },
      {
        label: t.navigation.forum,
        path: APP_ROUTES.ADMIN_FORUM,
        icon: 'forum',
        badgeCount: badgeCounts.forum,
      },
      {
        label: t.navigation.reports,
        path: APP_ROUTES.ADMIN_REPORTS,
        icon: 'payments',
        badgeCount: badgeCounts.reports,
      },
      { label: t.navigation.packages, path: APP_ROUTES.ADMIN_PACKAGES, icon: 'packages' },
      {
        label: t.navigation.feedback,
        path: APP_ROUTES.ADMIN_FEEDBACK,
        icon: 'feedback',
        badgeCount: badgeCounts.feedback,
      },
    ],
    [badgeCounts.feedback, badgeCounts.forum, badgeCounts.map, badgeCounts.reports, t]
  );
  const displayName = user?.fullName || user?.fullname || t.role;
  const avatarUrl =
    user?.avatarUrl ||
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 rx=%2230%22 fill=%22%2315233a%22/%3E%3Ccircle cx=%2260%22 cy=%2248%22 r=%2222%22 fill=%22%23d9e6ff%22/%3E%3Cpath d=%22M24 98c8-18 24-26 36-26s28 8 36 26%22 fill=%22%23d9e6ff%22/%3E%3C/svg%3E';

  useEffect(() => {
    let isActive = true;
    let refreshTimeoutId = null;

    const loadBadgeCounts = async () => {
      const [venuesResult, updatesResult, forumResult, reportsResult, feedbackResult] = await Promise.allSettled([
        fetchAdminVenues({ status: 'pending' }),
        fetchAdminVenueUpdateRequests({ status: 'pending' }),
        fetchAdminForumPosts(),
        fetchAdminRevenueReport(3),
        fetchAdminFeedbackReports({ status: 'new', page: 1, pageSize: 1 }),
      ]);

      if (!isActive) {
        return;
      }

      setBadgeCounts((prev) => {
        const next = { ...prev };

        if (venuesResult.status === 'fulfilled' && updatesResult.status === 'fulfilled') {
          const venues = Array.isArray(venuesResult.value) ? venuesResult.value : [];
          const updateRequests = Array.isArray(updatesResult.value) ? updatesResult.value : [];
          const pendingVenues = venues.filter((venue) => String(venue?.status || '').toLowerCase() === 'pending').length;
          const pendingUpdates = updateRequests.filter((request) => String(request?.status || '').toLowerCase() === 'pending').length;
          next.map = pendingVenues + pendingUpdates;
        }

        if (forumResult.status === 'fulfilled') {
          const posts = Array.isArray(forumResult.value) ? forumResult.value : [];
          const reportedPosts = posts.filter((post) => Number(post?.reportCount || 0) > 0).length;
          const reportedComments = posts.reduce(
            (acc, post) =>
              acc +
              (Array.isArray(post?.commentsList)
                ? post.commentsList.filter((comment) => Number(comment?.reportCount || 0) > 0).length
                : 0),
            0
          );
          next.forum = reportedPosts + reportedComments;
        }

        if (reportsResult.status === 'fulfilled') {
          const recentPayments = Array.isArray(reportsResult.value?.recentPayments)
            ? reportsResult.value.recentPayments
            : [];
          const lastSeen = Number(window.localStorage.getItem(REPORTS_LAST_SEEN_KEY) || 0);
          next.reports = recentPayments.filter((payment) => toTimestamp(payment?.paidAt) > lastSeen).length;
        }

        if (feedbackResult.status === 'fulfilled') {
          const payload = feedbackResult.value || {};
          const total = Number(payload?.pagination?.total || 0);
          const items = Array.isArray(payload?.items) ? payload.items.length : 0;
          next.feedback = total || items;
        }

        return next;
      });
    };

    const requestRefresh = () => {
      if (!isActive) {
        return;
      }

      if (refreshTimeoutId) {
        return;
      }

      refreshTimeoutId = window.setTimeout(() => {
        refreshTimeoutId = null;
        loadBadgeCounts();
      }, REFRESH_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        requestRefresh();
      }
    };

    loadBadgeCounts();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      requestRefresh();
    }, BADGE_REFRESH_MS);

    window.addEventListener('focus', requestRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(BADGE_REFRESH_EVENT, requestRefresh);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      if (refreshTimeoutId) {
        window.clearTimeout(refreshTimeoutId);
      }
      window.removeEventListener('focus', requestRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(BADGE_REFRESH_EVENT, requestRefresh);
    };
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-panel">
          <div className="admin-sidebar-head">
            <div>
              <p className="admin-sidebar-eyebrow">{t.controlTower}</p>
              <h1>{t.title}</h1>
            </div>

            <div className="admin-sidebar-user">
              <img src={avatarUrl} alt={displayName} className="admin-sidebar-user-avatar" />
              <div>
                <strong>{displayName}</strong>
                <span>{t.role}</span>
              </div>
            </div>
          </div>

          <nav className="admin-nav" data-onboarding="admin-nav">
            {adminNavigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === APP_ROUTES.ADMIN_DASHBOARD}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? 'is-active' : ''}`.trim()
                }
              >
                <span className="admin-nav-icon">
                  <NavGlyph type={item.icon} />
                </span>
                <span className="admin-nav-label">{item.label}</span>
                {item.badgeCount > 0 ? (
                  <span className="admin-nav-badge" aria-label={`${item.badgeCount} ${t.badges.newItems}`}>
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <button type="button" className="admin-logout-button" onClick={logout}>
              {t.logout}
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar" data-onboarding="admin-topbar">
          <div className="admin-topbar-actions">
            <label className="admin-lang-wrap">
              <span>{t.language}</span>
              <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <div className="admin-avatar-block">
              <img src={avatarUrl} alt={displayName} className="admin-avatar" />
            </div>
          </div>
        </header>

        <section className="admin-content-frame">
          <div className="admin-content-glow admin-content-glow-left" />
          <div className="admin-content-glow admin-content-glow-right" />
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AdminLayout;

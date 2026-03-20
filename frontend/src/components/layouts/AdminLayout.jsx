import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ROUTES } from '../../constants/routes';
import './AdminLayout.css';

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

function NotificationGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a4 4 0 0 1 4 4v2.2c0 .8.24 1.58.68 2.24L18 14.5v1.5H6v-1.5l1.32-2.06c.44-.66.68-1.44.68-2.24V8a4 4 0 0 1 4-4Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

const adminNavigation = [
  { label: 'Dashboard', path: APP_ROUTES.ADMIN_DASHBOARD, icon: 'dashboard' },
  { label: 'User Management', path: APP_ROUTES.ADMIN_USERS, icon: 'users' },
  { label: 'Map Management', path: APP_ROUTES.ADMIN_BOUNDARIES, icon: 'map' },
  { label: 'Reports & Revenue', path: APP_ROUTES.ADMIN_REPORTS, icon: 'payments' },
  { label: 'Ad Packages', path: APP_ROUTES.ADMIN_APPROVALS, icon: 'packages' },
  { label: 'Feedback & Support', path: APP_ROUTES.ADMIN_FEEDBACK, icon: 'feedback' },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const displayName = user?.fullName || user?.fullname || 'Administrator';
  const avatarUrl =
    user?.avatarUrl ||
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 rx=%2230%22 fill=%22%2315233a%22/%3E%3Ccircle cx=%2260%22 cy=%2248%22 r=%2222%22 fill=%22%23d9e6ff%22/%3E%3Cpath d=%22M24 98c8-18 24-26 36-26s28 8 36 26%22 fill=%22%23d9e6ff%22/%3E%3C/svg%3E';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-panel">
          <div className="admin-sidebar-head">
            <div>
              <p className="admin-sidebar-eyebrow">Control Tower</p>
              <h1>Admin</h1>
            </div>

            <div className="admin-sidebar-user">
              <img src={avatarUrl} alt={displayName} className="admin-sidebar-user-avatar" />
              <div>
                <strong>{displayName}</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>

          <nav className="admin-nav">
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
              </NavLink>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <button type="button" className="admin-logout-button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-actions">
            <button type="button" className="admin-notification-button" aria-label="Notifications">
              <span className="admin-notification-icon" aria-hidden="true">
                <NotificationGlyph />
              </span>
            </button>

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

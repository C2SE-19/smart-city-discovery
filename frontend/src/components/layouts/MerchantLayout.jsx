import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import NotificationBell from '../notifications/NotificationBell';
import logo from '../../assets/images/logo.png';
import '../layouts/LandingLayout.css';

function MerchantLayout() {
  const navigate = useNavigate();
  const { language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const t = translations[language];
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!showProfileMenu) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitial = () => {
    if (user?.fullname) {
      return user.fullname.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="landing-shell">
      <div className="landing-page">
        <header className="landing-header">
          <Link to="/" className="landing-logo" aria-label="Smart City homepage">
            <span className="landing-logo-mark">
              <img src={logo} alt="Smart City Logo" className="landing-logo-image" />
            </span>
            <span className="landing-logo-copy">
              <strong>Smart City</strong>
              <span>Discovery</span>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => `landing-nav-link${isActive ? ' is-active' : ''}`}>
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
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="landing-language-select"
              aria-label="Select language"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
            <button
              type="button"
              className="landing-onboarding-trigger"
              aria-label="Open onboarding guide"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('smart-city-onboarding-restart'));
              }}
            >
              ?
            </button>
            <NotificationBell />
            
            {/* User Profile Dropdown */}
            <div className="landing-profile-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="landing-profile-button"
                onClick={() => setShowProfileMenu((current) => !current)}
              >
                <div className="landing-avatar-initial">{getUserInitial()}</div>
                <span className="landing-profile-dropdown-icon">▼</span>
              </button>

              {showProfileMenu && (
                <div className="landing-profile-dropdown">
                  <div className="landing-dropdown-header">
                    {t.profile.hello}, {user?.fullname || 'User'}
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
                      navigate(APP_ROUTES.MERCHANT_POSTS);
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

        <main className="landing-main" style={{ paddingTop: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MerchantLayout;

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import logo from '../../assets/images/logo.png';
import '../layouts/LandingLayout.css';

function MerchantLayout() {
  const navigate = useNavigate();
  const { language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const t = translations[language];

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
          </nav>

          <div className="landing-header-actions">
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="landing-language-select"
              aria-label="Select language"
            >
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
            </select>
            <button type="button" className="landing-icon-button" aria-label={t.header.search} />
            <button 
              type="button"
              className="landing-login"
              onClick={() => navigate('/discovery')}
            >
              {t.header.login}
            </button>
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

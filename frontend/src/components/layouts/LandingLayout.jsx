import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import logo from '../../assets/images/logo.png';
import './LandingLayout.css';

const paymentMethods = ['VISA', 'KHEO', 'PayPal'];

function LandingLayout() {
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
            <Link to="/discovery" className="landing-login">
              {t.header.login}
            </Link>
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

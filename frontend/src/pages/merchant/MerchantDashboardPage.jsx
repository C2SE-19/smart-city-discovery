import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import './MerchantDashboard.css';

const MenuItems = [
  { id: 'overview', icon: '🏠', translationKey: 'overview' },
  { id: 'posts', icon: '🏪', translationKey: 'posts' },
  { id: 'transactions', icon: '📊', translationKey: 'transactions' },
  { id: 'support', icon: '💬', translationKey: 'support' }
];

function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const t = translations[language];
  const [activeMenu, setActiveMenu] = useState('overview');

  const getUserInitial = () => {
    if (user?.fullname) {
      return user.fullname.charAt(0).toUpperCase();
    }
    return 'H';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePublishClick = () => {
    navigate('/merchant/workbench');
  };

  const handleMenuClick = (menuId) => {
    setActiveMenu(menuId);
    
    // Navigate to appropriate page
    if (menuId === 'posts') {
      navigate('/merchant/posts');
    } else if (menuId === 'transactions') {
      navigate('/merchant/transactions');
    } else if (menuId === 'support') {
      navigate('/merchant/support');
    } else if (menuId === 'overview') {
      navigate('/merchant');
    }
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'overview':
        return (
          <div className="merchant-dashboard-content">
            <h2>{t.merchant.hello}</h2>
            <p>{t.merchant.selectFromMenu}</p>
          </div>
        );
      default:
        return (
          <div className="merchant-dashboard-content">
            <p>{t.merchant.contentHere}</p>
          </div>
        );
    }
  };

  return (
    <div className="merchant-dashboard-container">
      <div className="merchant-shell">
        {/* Sidebar */}
        <aside className="merchant-sidebar" data-onboarding="merchant-sidebar">
          <div className="merchant-sidebar-header">
            <div className="merchant-user-info">
              <div className="merchant-user-avatar">{getUserInitial()}</div>
              <div className="merchant-user-details">
                <h3>{user?.fullname || 'Nguyễn Hữu Lộc'}</h3>
                <p>Merchant</p>
              </div>
            </div>
          </div>

          {/* Publish Button */}
          <button 
            className="merchant-publish-btn"
            onClick={handlePublishClick}
            data-onboarding="merchant-publish-button"
          >
            {t.merchant.publish}
          </button>

          {/* Menu Items */}
          <nav className="merchant-menu" data-onboarding="merchant-menu">
            {MenuItems.map(item => (
              <button
                key={item.id}
                className={`merchant-menu-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => handleMenuClick(item.id)}
              >
                <span className="merchant-menu-icon">{item.icon}</span>
                <span className="merchant-menu-label">{t.merchant[item.translationKey]}</span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="merchant-sidebar-footer">
            <button className="merchant-logout-btn" onClick={handleLogout}>{t.merchant.logout}</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="merchant-main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default MerchantDashboardPage;

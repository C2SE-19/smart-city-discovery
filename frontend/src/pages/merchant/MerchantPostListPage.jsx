import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import './MerchantPostList.css';

const MenuItems = [
  { id: 'overview', icon: '🏠', translationKey: 'overview' },
  { id: 'posts', icon: '🏪', translationKey: 'posts' },
  { id: 'transactions', icon: '📊', translationKey: 'transactions' },
  { id: 'support', icon: '💬', translationKey: 'support' }
];

// Mock data for posts
const mockPosts = [
  {
    id: 1,
    name: 'Quán Mì Quảng Bà Bình',
    price: '40,000 - 80,000',
    rating: 4.7,
    reviews: 3,
    image: 'https://via.placeholder.com/200x150?text=Mì+Quảng'
  },
  {
    id: 2,
    name: 'Quán Cơm Tấm Sài Gòn',
    price: '30,000 - 60,000',
    rating: 4.5,
    reviews: 5,
    image: 'https://via.placeholder.com/200x150?text=Cơm+Tấm'
  }
];

function MerchantPostListPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const t = translations[language];
  const [posts, setPosts] = useState(mockPosts);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState('posts');

  const handlePublishClick = () => {
    navigate('/merchant/workbench');
  };

  const handleMenuClick = (menuId) => {
    setActiveMenu(menuId);
    if (menuId === 'overview') {
      navigate('/merchant');
    } else if (menuId === 'transactions') {
      navigate('/merchant/transactions');
    } else if (menuId === 'support') {
      navigate('/merchant/support');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitial = () => {
    if (user?.fullname) {
      return user.fullname.charAt(0).toUpperCase();
    }
    return 'H';
  };

  const handleEditPost = (postId) => {
    navigate(`/merchant/workbench/${postId}`);
  };

  const handleDeletePost = (postId) => {
    if (window.confirm(t.merchant.confirmDelete)) {
      setPosts(posts.filter(p => p.id !== postId));
    }
  };

  const filteredPosts = posts.filter(post =>
    post.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="merchant-posts-wrapper">
      {/* Sidebar */}
      <aside className="merchant-sidebar">
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
        >
          {t.merchant.publish}
        </button>

        {/* Menu Items */}
        <nav className="merchant-menu">
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
          <button className="merchant-logout-btn" onClick={handleLogout}>
            {t.merchant.logout}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="merchant-posts-main">
        {/* Header */}
        <div className="merchant-post-header-section">
          <div className="merchant-post-header-top">
            <div className="merchant-profile-left">
              <div className="merchant-profile-avatar-large">{getUserInitial()}</div>
              <div className="merchant-profile-details">
                <h2>{user?.fullname || 'Nguyễn Hữu Lộc'}</h2>
                <div className="merchant-followers-info">
                  <span>Người theo dõi: 18</span>
                  <span>Danh theo dõi: 3</span>
                </div>
              </div>
            </div>

            <div className="merchant-rating-section">
              <div className="merchant-rating-stars">⭐⭐⭐⭐⭐</div>
              <div className="merchant-rating-score">4.7 (14 đánh giá)</div>
            </div>

            <button 
              className="merchant-post-publish-btn-header"
              onClick={handlePublishClick}
            >
              {t.merchant.publish}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="merchant-post-tabs">
          <button className="merchant-tab active">{t.merchant.activeAll}</button>
          <button className="merchant-tab">{t.merchant.pending} (1)</button>
          <button className="merchant-tab">{t.merchant.rejected} (1)</button>
        </div>

        {/* Search */}
        <div className="merchant-post-search">
          <input
            type="text"
            placeholder={t.merchant.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Posts List */}
        <div className="merchant-post-list">
          {filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <div key={post.id} className="merchant-post-card">
                <img 
                  src={post.image} 
                  alt={post.name}
                  className="merchant-post-image"
                />
                <div className="merchant-post-info">
                  <h3>{post.name}</h3>
                  <p className="merchant-post-price">{post.price}</p>
                  <div className="merchant-post-rating">
                    <span className="merchant-post-stars">⭐ {post.rating}</span>
                    <span className="merchant-post-review-count">({post.reviews} {t.merchant.reviews})</span>
                  </div>
                </div>
                <div className="merchant-post-actions">
                  <button 
                    className="merchant-post-edit-btn"
                    onClick={() => handleEditPost(post.id)}
                  >
                    {t.merchant.edit}
                  </button>
                  <button 
                    className="merchant-post-delete-btn"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    {t.merchant.delete}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="merchant-post-empty">
              <p>{t.merchant.noPostsFound}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MerchantPostListPage;

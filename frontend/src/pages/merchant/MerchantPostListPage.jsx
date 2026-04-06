import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import { fetchMyVenueSubmissions } from '../../services/api/venuesApi';
import './MerchantPostList.css';

const MenuItems = [
  { id: 'overview', icon: '🏠', translationKey: 'overview' },
  { id: 'posts', icon: '🏪', translationKey: 'posts' },
  { id: 'transactions', icon: '📊', translationKey: 'transactions' },
  { id: 'support', icon: '💬', translationKey: 'support' }
];

const POST_STATUSES = {
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected'
};

const FALLBACK_POST_IMAGE = 'https://via.placeholder.com/200x150?text=Venue';

function resolveApiOrigin() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return 'http://localhost:5000';
  }
}

function resolveVenueImageUrl(rawUrl) {
  const normalizedUrl = String(rawUrl || '').trim();

  if (!normalizedUrl || normalizedUrl.toLowerCase() === 'nan' || normalizedUrl.toLowerCase() === 'null') {
    return '';
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  const apiOrigin = resolveApiOrigin();
  if (normalizedUrl.startsWith('/')) {
    return `${apiOrigin}${normalizedUrl}`;
  }

  return `${apiOrigin}/${normalizedUrl}`;
}

function normalizeVenueMetadata(metadata) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function formatPriceRange(metadata) {
  const minPrice = Number(metadata.minPrice);
  const maxPrice = Number(metadata.maxPrice);

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  return `${minPrice.toLocaleString('vi-VN')} - ${maxPrice.toLocaleString('vi-VN')}`;
}

function mapVenueToPost(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const coverImageUrl = resolveVenueImageUrl(venue.cover_image_url);
  const galleryImageUrl = resolveVenueImageUrl(metadata.galleryImages?.[0]);

  return {
    id: Number(venue.id),
    name: venue.title || venue.name || 'Untitled venue',
    image: coverImageUrl || galleryImageUrl || FALLBACK_POST_IMAGE,
    price: formatPriceRange(metadata),
    rating: Number(metadata.averageRating) || 0,
    reviews: Number(metadata.reviewCount) || 0,
    status: String(venue.status || '').toLowerCase(),
    rejectionReason: venue.rejection_reason || ''
  };
}

function MerchantPostListPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const t = translations[language];
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeStatus, setActiveStatus] = useState(POST_STATUSES.approved);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState('posts');
  const copy = {
    followers: language === 'en' ? 'Followers' : 'Người theo dõi',
    following: language === 'en' ? 'Following' : 'Đang theo dõi',
    ratingCount: language === 'en' ? 'reviews' : 'đánh giá'
  };

  useEffect(() => {
    async function loadMerchantPosts() {
      setLoadingPosts(true);
      setLoadError('');

      try {
        const venueRows = await fetchMyVenueSubmissions({
          status: `${POST_STATUSES.approved},${POST_STATUSES.pending},${POST_STATUSES.rejected}`
        });

        const normalizedPosts = Array.isArray(venueRows) ? venueRows.map(mapVenueToPost) : [];
        setPosts(normalizedPosts);
      } catch (error) {
        setLoadError(error.response?.data?.message || 'Không thể tải danh sách bài đăng của bạn.');
      } finally {
        setLoadingPosts(false);
      }
    }

    loadMerchantPosts();
  }, []);

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
      navigate(APP_ROUTES.FEEDBACK);
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
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
    }
  };

  const statusCounts = useMemo(() => {
    const initialCounts = {
      [POST_STATUSES.approved]: 0,
      [POST_STATUSES.pending]: 0,
      [POST_STATUSES.rejected]: 0
    };

    return posts.reduce((counts, post) => {
      if (Object.prototype.hasOwnProperty.call(counts, post.status)) {
        counts[post.status] += 1;
      }

      return counts;
    }, initialCounts);
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          post.status === activeStatus && post.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ),
    [posts, activeStatus, searchTerm]
  );

  const emptyMessage =
    activeStatus === POST_STATUSES.pending
      ? language === 'en'
        ? 'No posts are waiting for admin review.'
        : 'Hiện chưa có bài đăng nào đang chờ duyệt.'
      : activeStatus === POST_STATUSES.rejected
        ? language === 'en'
          ? 'No rejected posts.'
          : 'Hiện chưa có bài đăng nào bị từ chối.'
        : t.merchant.noPostsFound;

  return (
  <div className={`merchant-posts-wrapper theme-${theme}`}>
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
                  <span>{copy.followers}: 18</span>
                  <span>{copy.following}: 3</span>
                </div>
              </div>
            </div>

            <div className="merchant-rating-section">
              <div className="merchant-rating-stars">⭐⭐⭐⭐⭐</div>
              <div className="merchant-rating-score">4.7 (14 {copy.ratingCount})</div>
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
          <button
            className={`merchant-tab ${activeStatus === POST_STATUSES.approved ? 'active' : ''}`}
            onClick={() => setActiveStatus(POST_STATUSES.approved)}
          >
            {t.merchant.activeAll} ({statusCounts[POST_STATUSES.approved]})
          </button>
          <button
            className={`merchant-tab ${activeStatus === POST_STATUSES.pending ? 'active' : ''}`}
            onClick={() => setActiveStatus(POST_STATUSES.pending)}
          >
            {t.merchant.pending} ({statusCounts[POST_STATUSES.pending]})
          </button>
          <button
            className={`merchant-tab ${activeStatus === POST_STATUSES.rejected ? 'active' : ''}`}
            onClick={() => setActiveStatus(POST_STATUSES.rejected)}
          >
            {t.merchant.rejected} ({statusCounts[POST_STATUSES.rejected]})
          </button>
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
          {loadingPosts ? (
            <div className="merchant-post-empty">
              <p>{language === 'en' ? 'Loading posts...' : 'Đang tải bài đăng...'}</p>
            </div>
          ) : loadError ? (
            <div className="merchant-post-empty">
              <p>{loadError}</p>
            </div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <div key={post.id} className="merchant-post-card">
                <img 
                  src={post.image} 
                  alt={post.name}
                  className="merchant-post-image"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_POST_IMAGE;
                  }}
                />
                <div className="merchant-post-info">
                  <h3>{post.name}</h3>
                  <p className="merchant-post-price">{post.price || (language === 'en' ? 'Price updating' : 'Đang cập nhật giá')}</p>
                  <div className="merchant-post-rating">
                    <span className="merchant-post-stars">⭐ {post.rating}</span>
                    <span className="merchant-post-review-count">({post.reviews} {t.merchant.reviews})</span>
                  </div>
                  {post.status === POST_STATUSES.rejected && post.rejectionReason ? (
                    <p className="merchant-post-review-count">{language === 'en' ? 'Reason' : 'Lý do'}: {post.rejectionReason}</p>
                  ) : null}
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
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MerchantPostListPage;

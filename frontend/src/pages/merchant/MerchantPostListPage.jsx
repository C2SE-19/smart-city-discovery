import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import {
  deleteMerchantVenuePost,
  fetchMyVenueSubmissions,
  fetchMyVenueUpdateRequests,
  toggleMerchantVenuePauseStatus,
} from '../../services/api/venuesApi';
import { getApiOrigin } from '../../services/api/client';
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
  rejected: 'rejected',
  hidden: 'hidden',
};

const FALLBACK_POST_IMAGE = 'https://via.placeholder.com/200x150?text=Venue';

function resolveVenueImageUrl(rawUrl) {
  const normalizedUrl = String(rawUrl || '').trim();

  if (!normalizedUrl || normalizedUrl.toLowerCase() === 'nan' || normalizedUrl.toLowerCase() === 'null') {
    return '';
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  const apiOrigin = getApiOrigin();
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

function extractMetadataImageCandidates(metadata) {
  const normalizedMetadata = normalizeVenueMetadata(metadata);
  const rawCandidates = [];
  const sourceGroups = [
    normalizedMetadata.galleryImages,
    normalizedMetadata.images,
    normalizedMetadata.imageUrls,
    normalizedMetadata.photos,
  ];

  sourceGroups.forEach((group) => {
    if (!Array.isArray(group)) {
      return;
    }

    group.forEach((item) => {
      if (typeof item === 'string') {
        rawCandidates.push(item);
        return;
      }

      if (item && typeof item === 'object') {
        rawCandidates.push(item.url || item.image_url || item.imageUrl || item.src || '');
      }
    });
  });

  return rawCandidates
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function resolveFirstValidImage(candidates) {
  for (const candidate of candidates) {
    const resolvedImage = resolveVenueImageUrl(candidate);
    if (resolvedImage) {
      return resolvedImage;
    }
  }

  return '';
}

function resolveVenuePreviewImageUrl(venue) {
  const metadataImageCandidates = extractMetadataImageCandidates(venue?.metadata);
  const tableGalleryImages = Array.isArray(venue?.venue_images) ? venue.venue_images : [];

  return resolveFirstValidImage([
    venue?.cover_image_url,
    venue?.venue_primary_image_url,
    ...metadataImageCandidates,
    ...tableGalleryImages,
  ]);
}

function resolveUpdateRequestPreviewImageUrl(updateRequest, proposedSnapshot) {
  const metadataImageCandidates = extractMetadataImageCandidates(proposedSnapshot?.metadata);

  return resolveFirstValidImage([
    proposedSnapshot?.coverImageUrl,
    updateRequest?.venue_cover_image_url,
    updateRequest?.venue_primary_image_url,
    ...metadataImageCandidates,
  ]);
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
  const previewImageUrl = resolveVenuePreviewImageUrl(venue);
  const normalizedStatus = String(venue.status || '').toLowerCase();

  return {
    id: `venue-${Number(venue.id)}`,
    venueId: Number(venue.id),
    kind: 'venue',
    name: venue.title || venue.name || 'Untitled venue',
    image: previewImageUrl || FALLBACK_POST_IMAGE,
    price: formatPriceRange(metadata),
    rating: Number(metadata.averageRating) || 0,
    reviews: Number(metadata.reviewCount) || 0,
    status: normalizedStatus,
    rejectionReason: venue.rejection_reason || '',
    rejectionTopic: normalizedStatus === POST_STATUSES.rejected ? 'Post rejected' : '',
  };
}

function mapRejectedUpdateRequestToPost(updateRequest) {
  const proposedSnapshot =
    updateRequest?.proposed_snapshot && typeof updateRequest.proposed_snapshot === 'object'
      ? updateRequest.proposed_snapshot
      : {};
  const proposedMetadata = normalizeVenueMetadata(proposedSnapshot.metadata);
  const previewImageUrl = resolveUpdateRequestPreviewImageUrl(updateRequest, proposedSnapshot);

  return {
    id: `update-request-${Number(updateRequest.id)}`,
    venueId: Number(updateRequest.venue_id),
    kind: 'update-request',
    name:
      updateRequest?.venue_title ||
      updateRequest?.venue_name ||
      proposedSnapshot.title ||
      proposedSnapshot.name ||
      `Venue #${updateRequest?.venue_id || 'N/A'}`,
    image: previewImageUrl || FALLBACK_POST_IMAGE,
    price: formatPriceRange(proposedMetadata),
    rating: 0,
    reviews: 0,
    status: POST_STATUSES.rejected,
    rejectionReason: updateRequest?.rejection_reason || '',
    rejectionTopic: 'Location update rejected',
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
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [togglingPausePostId, setTogglingPausePostId] = useState(null);

  useEffect(() => {
    async function loadMerchantPosts() {
      setLoadingPosts(true);
      setLoadError('');

      try {
        const [venueRows, rejectedUpdateRows] = await Promise.all([
          fetchMyVenueSubmissions({
            status: `${POST_STATUSES.approved},${POST_STATUSES.pending},${POST_STATUSES.rejected},${POST_STATUSES.hidden}`
          }),
          fetchMyVenueUpdateRequests({ status: POST_STATUSES.rejected }),
        ]);

        const normalizedVenuePosts = Array.isArray(venueRows) ? venueRows.map(mapVenueToPost) : [];
        const normalizedRejectedUpdatePosts = Array.isArray(rejectedUpdateRows)
          ? rejectedUpdateRows.map(mapRejectedUpdateRequestToPost)
          : [];

        setPosts([...normalizedVenuePosts, ...normalizedRejectedUpdatePosts]);
      } catch (error) {
        setLoadError(error.response?.data?.message || 'Could not load your posts. Please refresh and try again.');
      } finally {
        setLoadingPosts(false);
      }
    }

    loadMerchantPosts();
  }, []);

  const handlePublishClick = () => {
    navigate('/merchant/workbench');
  };

  const handleAdvertiseAccount = () => {
    navigate(APP_ROUTES.MERCHANT_POST_ADVERTISE);
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

  const handleEditPost = (post) => {
    if (!post?.venueId || post.status !== POST_STATUSES.approved || post.kind !== 'venue') {
      return;
    }

    navigate(`/merchant/workbench/${post.venueId}`);
  };

  const handleDeletePost = async (post) => {
    if (!post?.venueId) {
      return;
    }

    if (!window.confirm(t.merchant.confirmDelete)) {
      return;
    }

    setDeletingPostId(post.id);
    setLoadError('');

    try {
      await deleteMerchantVenuePost(post.venueId);
      setPosts((currentPosts) => currentPosts.filter((item) => Number(item.venueId) !== Number(post.venueId)));
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not delete this post. Please try again.');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleTogglePausePost = async (post) => {
    if (!post?.venueId || post.kind !== 'venue') {
      return;
    }

    setTogglingPausePostId(post.id);
    setLoadError('');

    try {
      const response = await toggleMerchantVenuePauseStatus(post.venueId);
      const nextStatus = String(response?.venue?.status || '').toLowerCase();

      if (!nextStatus) {
        return;
      }

      setPosts((currentPosts) =>
        currentPosts.map((item) =>
          Number(item.venueId) === Number(post.venueId)
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not update venue visibility. Please try again.');
    } finally {
      setTogglingPausePostId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const initialCounts = {
      [POST_STATUSES.approved]: 0,
      [POST_STATUSES.pending]: 0,
      [POST_STATUSES.rejected]: 0
    };

    return posts.reduce((counts, post) => {
      if (post.status === POST_STATUSES.hidden) {
        counts[POST_STATUSES.approved] += 1;
        return counts;
      }

      if (Object.prototype.hasOwnProperty.call(counts, post.status)) {
        counts[post.status] += 1;
      }

      return counts;
    }, initialCounts);
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) => {
          const matchesStatus = activeStatus === POST_STATUSES.approved
            ? [POST_STATUSES.approved, POST_STATUSES.hidden].includes(post.status)
            : post.status === activeStatus;

          return matchesStatus && post.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
        }
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
        <div data-onboarding="merchant-sidebar">
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
        <div className="merchant-primary-actions" data-onboarding="merchant-publish-button">
          <button
            className="merchant-publish-btn merchant-primary-action-btn"
            onClick={handlePublishClick}
          >
            {t.merchant.publish}
          </button>
          <button
            className="merchant-advertise-btn merchant-primary-action-btn"
            type="button"
            onClick={handleAdvertiseAccount}
          >
            Advertise
          </button>
          </div>

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
          <div className="merchant-sidebar-footer">
            <button className="merchant-logout-btn" onClick={handleLogout}>
              {t.merchant.logout}
            </button>
          </div>
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
                <p className="merchant-profile-role">Merchant</p>
              </div>
            </div>

            <div className="merchant-post-header-actions">
              <button
                className="merchant-post-advertise-btn-header"
                onClick={handleAdvertiseAccount}
              >
                Advertise
              </button>
              <button
                className="merchant-post-publish-btn-header"
                onClick={handlePublishClick}
              >
                {t.merchant.publish}
              </button>
            </div>
          </div>
          <p className="merchant-post-header-note">
            Advertising packages now apply to your whole merchant account, not to individual venues.
          </p>
        </div>

        {/* Tabs */}
        <div className="merchant-post-tabs" data-onboarding="merchant-post-tabs">
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
        <div className="merchant-post-list" data-onboarding="merchant-post-list">
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
                  {post.status === POST_STATUSES.rejected && post.rejectionTopic ? (
                    <p className="merchant-post-topic">
                      {language === 'en' ? 'Topic' : 'Chủ đề'}: {post.rejectionTopic}
                    </p>
                  ) : null}
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
                  {post.status === POST_STATUSES.approved && post.kind === 'venue' ? (
                    <button
                      className="merchant-post-edit-btn"
                      onClick={() => handleEditPost(post)}
                    >
                      {t.merchant.edit}
                    </button>
                  ) : null}
                  {post.kind === 'venue' && [POST_STATUSES.approved, POST_STATUSES.hidden].includes(post.status) ? (
                    <button
                      className={`merchant-post-pause-btn ${post.status === POST_STATUSES.hidden ? 'is-paused' : ''}`.trim()}
                      disabled={togglingPausePostId === post.id}
                      onClick={() => handleTogglePausePost(post)}
                    >
                      {togglingPausePostId === post.id
                        ? 'Updating...'
                        : post.status === POST_STATUSES.hidden
                          ? 'Resume Shop'
                          : 'Pause Shop'}
                    </button>
                  ) : null}
                  <button 
                    className="merchant-post-delete-btn"
                    disabled={deletingPostId === post.id}
                    onClick={() => handleDeletePost(post)}
                  >
                    {deletingPostId === post.id ? 'Deleting...' : t.merchant.delete}
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

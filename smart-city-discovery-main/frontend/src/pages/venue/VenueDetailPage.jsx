import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import { fetchVenues } from '../../services/api/venuesApi';
import { APP_ROUTES } from '../../constants/routes';

import './VenueDetailPage.css';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x360?text=No+Image';

function normalizeVenueMetadata(metadata) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) return metadata;
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function VenueDetailPage() {
  const { venueId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { language } = useLanguage();
  const { token, user } = useAuth();
  const t = translations[language] || translations.en;

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  const [venue, setVenue] = useState(location.state?.venue || null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(!location.state?.venue);
  const [error, setError] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [errorToast, setErrorToast] = useState('');
  const [commentFormError, setCommentFormError] = useState('');
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [likedReviewIds, setLikedReviewIds] = useState(new Set());
  const [isImageFavorited, setIsImageFavorited] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isInCollection, setIsInCollection] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyForm, setReplyForm] = useState({ rating: 4, title: '' });
  const [replyMedia, setReplyMedia] = useState({ photos: [], videos: [] });
  const [replyFormError, setReplyFormError] = useState('');
  const replyUploadRef = useRef(null);
  const [newReview, setNewReview] = useState({
    rating: 4,
    title: '',
    content: '',
    photos: [],
    videos: []
  });

  const uploadInputRef = useRef(null);

  const metadata = useMemo(() => normalizeVenueMetadata(venue?.metadata), [venue]);
  const defaultStartTime = useMemo(
    () => metadata?.startTime || metadata?.start_time || venue?.startTime || venue?.start_time || '06:30',
    [metadata, venue]
  );
  const defaultEndTime = useMemo(
    () => metadata?.endTime || metadata?.end_time || venue?.endTime || venue?.end_time || '22:00',
    [metadata, venue]
  );

  const weeklyHours = useMemo(() => {
    const base = metadata?.hoursByDay || metadata?.openingHours || metadata?.hours || null;
    const days = [
      { key: 'monday', label: 'Thứ hai' },
      { key: 'tuesday', label: 'Thứ ba' },
      { key: 'wednesday', label: 'Thứ tư' },
      { key: 'thursday', label: 'Thứ năm' },
      { key: 'friday', label: 'Thứ sáu' },
      { key: 'saturday', label: 'Thứ bảy' },
      { key: 'sunday', label: 'Chủ nhật' }
    ];

    const resolveValue = (day, idx) => {
      if (!base) return '';
      if (Array.isArray(base)) return base[idx] || '';
      const candidate =
        base?.[day.key] ||
        base?.[day.key.toUpperCase?.()] ||
        base?.[day.label] ||
        base?.[idx] ||
        base?.[String(idx)] ||
        base?.[day.key.slice(0, 3)];

      if (!candidate) return '';
      if (typeof candidate === 'string') return candidate;
      if (typeof candidate === 'object') {
        const start = candidate.start || candidate.open || candidate.from;
        const end = candidate.end || candidate.close || candidate.to;
        if (start && end) return `${start} - ${end}`;
      }
      return '';
    };

    return days.map((day, idx) => {
      const value = resolveValue(day, idx);
      const fallback = defaultStartTime && defaultEndTime ? `${defaultStartTime} - ${defaultEndTime}` : '—';
      return { ...day, value: value || fallback };
    });
  }, [metadata, defaultStartTime, defaultEndTime]);

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const isOpenNow = useMemo(() => {
    const dayMap = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
    const todayIdx = dayMap[new Date().getDay()] ?? 0;
    const today = weeklyHours[todayIdx];
    if (!today?.value) return false;

    const [startStr, endStr] = today.value.split('-').map((v) => v?.trim());
    const start = parseTimeToMinutes(startStr);
    const end = parseTimeToMinutes(endStr);
    if (start == null || end == null) return false;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= start && nowMinutes <= end;
  }, [weeklyHours]);
  const reviewPhotos = useMemo(() => {
    const fromReviews = reviews.flatMap((review) => review?.photos || []);
    const fromReplies = reviews.flatMap((review) => (review.replies || []).flatMap((r) => r.photos || []));
    const avatar = venue?.cover_image_url ? [venue.cover_image_url] : [];
    const metaGallery = Array.isArray(metadata?.gallery) ? metadata.gallery : [];
    return [...avatar, ...metaGallery, ...fromReviews, ...fromReplies].filter(Boolean);
  }, [reviews, venue?.cover_image_url, metadata?.gallery]);

  const persistReviews = (list) => {
    try {
      localStorage.setItem(`venue-${venueId}-reviews`, JSON.stringify(list));
    } catch (err) {
      console.error('Persist reviews failed', err);
    }
  };

  const mergeReviewsUnique = (list) => {
    const map = new Map();
    (list || []).forEach((item) => {
      const key = item?.id ?? item?.localId;
      if (!key) return;
      const existing = map.get(key) || {};
      const replies = item?.replies || existing?.replies || [];
      if (!map.has(key)) map.set(key, { ...item, replies });
      else map.set(key, { ...existing, ...item, replies });
    });
    return Array.from(map.values());
  };

  useEffect(() => {
    if (venue) return;

    async function loadVenue() {
      try {
        setLoading(true);
        const data = await fetchVenues();
        const found = data.find((v) => String(v.id) === String(venueId));
        if (!found) {
          setError('Venue not found');
          return;
        }
        setVenue(found);
      } catch {
        setError('Error loading venue');
      } finally {
        setLoading(false);
      }
    }

    loadVenue();
  }, [venue, venueId]);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await axios.get(`${apiUrl}/venues/${venueId}/reviews`);
        const serverList = mergeReviewsUnique(res.data?.reviews || []);
        setReviews(serverList);
        persistReviews(serverList);
      } catch (err) {
        console.error(err);
        const cached = localStorage.getItem(`venue-${venueId}-reviews`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const merged = mergeReviewsUnique(parsed);
              setReviews(merged);
            }
          } catch (error) {
            console.error('Read cached reviews failed', error);
          }
        }
      }
    }

    loadReviews();
  }, [apiUrl, venueId]);

  const reloadReviewsFromServer = async () => {
    try {
      const res = await axios.get(`${apiUrl}/venues/${venueId}/reviews`);
      const serverList = mergeReviewsUnique(res.data?.reviews || []);
      setReviews(serverList);
      persistReviews(serverList);
    } catch (err) {
      console.error('Reload reviews failed', err);
    }
  };

  const handleMediaUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') return;
        if (file.type.startsWith('image/')) {
          setNewReview((prev) => ({ ...prev, photos: [...prev.photos, result] }));
        } else if (file.type.startsWith('video/')) {
          setNewReview((prev) => ({ ...prev, videos: [...prev.videos, result] }));
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  };

  const handleRemoveMedia = (type, index) => {
    setNewReview((prev) => {
      const updated = [...prev[type]];
      updated.splice(index, 1);
      return { ...prev, [type]: updated };
    });
  };

  const formatReviewDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('vi-VN');
      }
      return String(value);
    }
    if (value instanceof Date) return value.toLocaleString('vi-VN');
    return '';
  };

  const handleToggleReviewLike = (reviewId) => {
    if (!reviewId) return;
    setLikedReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  const handleToggleImageFavorite = () => {
    setIsImageFavorited((prev) => !prev);
  };

  const handleToggleFavorite = () => {
    setIsFavorited((prev) => !prev);
    setShowFavoriteModal(true);
  };

  const handleToggleCollection = () => {
    setIsInCollection((prev) => !prev);
    setShowCollectionModal(true);
  };

  const handleDeleteReview = (reviewId) => {
    if (!reviewId) return;
    const review = reviews.find((item) => (item.id ?? item.localId) === reviewId);
    const reviewUserId = review?.user_id || review?.userId || review?.user?.id;
    const isOwner = reviewUserId && user?.id
      ? String(reviewUserId) === String(user.id)
      : review?.author && user?.fullname && review.author === user.fullname;

    if (!isOwner) return;
    if (!token) {
      setErrorToast('Bạn cần đăng nhập để xoá bình luận.');
      setTimeout(() => setErrorToast(''), 2000);
      return;
    }
    const confirmed = window.confirm('Bạn có chắc muốn xoá bình luận này không?');
    if (!confirmed) return;
    
    // Xóa ngay từ state UI
    setReviews((prev) => {
      const filtered = prev.filter((item) => (item.id ?? item.localId) !== reviewId);
      persistReviews(filtered);
      return filtered;
    });
    
    // Gửi request xóa đến backend
    axios.delete(
      `${apiUrl}/venues/${venueId}/reviews/${reviewId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch((err) => {
      console.error('Xóa bình luận thất bại:', err);
      setErrorToast('Lỗi khi xóa bình luận. Vui lòng tải lại trang.');
      setTimeout(() => setErrorToast(''), 3000);
      // Tải lại danh sách bình luận từ server
      reloadReviewsFromServer();
    });
  };

  const handleReplyDraftChange = (reviewKey, value) => {
    setReplyDrafts((prev) => ({ ...prev, [reviewKey]: value }));
  };

  const openReplyModal = (reviewKey) => {
    setReplyParentId(reviewKey);
    setShowReplyModal(true);
    setReplyDrafts((prev) => ({ ...prev, [reviewKey]: prev[reviewKey] || '' }));
    setReplyForm((prev) => ({ ...prev, rating: prev.rating || 4, title: prev.title || '' }));
    setReplyMedia({ photos: [], videos: [] });
  };

  const handleReplyMediaUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') return;
        if (file.type.startsWith('image/')) {
          setReplyMedia((prev) => ({ ...prev, photos: [...prev.photos, result] }));
        } else if (file.type.startsWith('video/')) {
          setReplyMedia((prev) => ({ ...prev, videos: [...prev.videos, result] }));
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  };

  const handleRemoveReplyMedia = (type, index) => {
    setReplyMedia((prev) => {
      const updated = [...prev[type]];
      updated.splice(index, 1);
      return { ...prev, [type]: updated };
    });
  };

  const handleSubmitReply = (reviewKey) => {
    const content = (replyDrafts[reviewKey] || '').trim();
    if (!content) return;
    
    // Kiểm tra từ tục tĩu
    const profanityList = ['địt', 'lon', 'lồn', 'cặc', 'cạc', 'cuc', 'cứt', 'fuck', 'shit', 'dm', 'đmm', 'đm', 'đụ', 'bitch', 'cc', 'cl'];
    const normalizedContent = content.toLowerCase().replace(/[^\w\s]/g, '');
    const hasProfanity = profanityList.some(word => normalizedContent.includes(word));
    
    if (hasProfanity || hasProfanity) {
      setReplyFormError('Nội dung chứa từ ngữ không phù hợp, vui lòng chỉnh sửa.');
      setTimeout(() => setReplyFormError(''), 3000);
      return;
    }
    
    const reply = {
      id: `reply-${Date.now()}`,
      author: user?.fullname || 'Khách',
      date: new Date().toLocaleString('vi-VN'),
      content,
      title: replyForm.title?.trim() || '',
      rating: replyForm.rating || null,
      photos: replyMedia.photos,
      videos: replyMedia.videos
    };

    setReviews((prev) => {
      const next = prev.map((item) => {
        const key = item.id ?? item.localId;
        if (key !== reviewKey) return item;
        const replies = [...(item.replies || []), reply];
        return { ...item, replies };
      });
      persistReviews(next);
      return next;
    });

    setReplyDrafts((prev) => ({ ...prev, [reviewKey]: '' }));
    setReplyForm({ rating: 4, title: '' });
    setReplyMedia({ photos: [], videos: [] });
    setShowReplyModal(false);
    setReplyParentId(null);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReview.content.trim()) return;
    if (!token) {
      navigate('/login');
      return;
    }

    const now = new Date();
    const fallbackReview = {
      localId: `local-${Date.now()}`,
      author: user?.fullname || 'Khách',
      date: now.toLocaleString('vi-VN'),
      rating: newReview.rating,
      title: newReview.title,
      content: newReview.content,
      photos: newReview.photos,
      videos: newReview.videos
    };

    try {
      const res = await axios.post(
        `${apiUrl}/venues/${venueId}/reviews`,
        {
          rating: newReview.rating,
          title: newReview.title,
          content: newReview.content,
          photos: newReview.photos,
          videos: newReview.videos
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const createdReview = res.data?.review
        ? { ...fallbackReview, ...res.data.review, localId: fallbackReview.localId }
        : fallbackReview;
      setReviews((prev) => {
        const merged = mergeReviewsUnique([createdReview, ...prev]);
        persistReviews(merged);
        return merged;
      });
      setNewReview({ rating: 4, title: '', content: '', photos: [], videos: [] });
      setShowCommentModal(false);
      reloadReviewsFromServer();
    } catch (err) {
      console.error(err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Gửi bình luận thất bại';
      setCommentFormError(errorMessage);
      setTimeout(() => setCommentFormError(''), 3000);
    }
  };

  if (loading) return <div className="venue-detail-page">Loading...</div>;
  if (error) return <div className="venue-detail-page">{error}</div>;

  const rating = reviews.length
    ? reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviews.length
    : 4.5;
  const reviewCount = reviews.length;
  const priceLabel = metadata?.priceLabel || metadata?.price_range || '25.000đ - 30.000đ';
  const wardLabel = venue?.ward_name || venue?.wardName || '';
  const shareUrl = window?.location?.href || `${window.location.origin}/venues/${venueId}`;

  return (
    <div className="venue-detail-page">
      {errorToast && <div className="toast-error">{errorToast}</div>}
      <section className="venue-detail-hero">
        <div className="venue-detail-banner">
          <img src={venue?.cover_image_url || PLACEHOLDER_IMAGE} alt={venue?.name} />
        </div>

        <div className="venue-detail-summary-card">
          <div className="venue-summary-left">
            <div className="venue-summary-image">
              <img src={venue?.cover_image_url || PLACEHOLDER_IMAGE} alt={venue?.name} />
              <button
                type="button"
                className={`venue-image-favorite ${isImageFavorited ? 'is-active' : ''}`}
                aria-label="Yêu thích"
                onClick={handleToggleImageFavorite}
              >
                {isImageFavorited ? '❤' : '♡'}
              </button>
            </div>
            <div className="venue-summary-meta">
              <p className="venue-summary-category">
                {metadata?.category || t.detail?.foodCategory || 'Ẩm thực'}
              </p>
              <h1>{venue?.name}</h1>
              <div className="venue-summary-row venue-summary-row--with-actions">
                <div className="venue-summary-address-group">
                  <span className="venue-summary-address">{venue?.address}</span>
                  {wardLabel && <span className="venue-summary-ward">{wardLabel}</span>}
                </div>
                <div className="venue-action-bar">
                  <div className="venue-summary-actions">
                      <div className="fav-collection-single">
                        <button
                          type="button"
                          className={`fav-mini ${isFavorited ? 'is-active' : ''}`}
              onClick={handleToggleFavorite}
                        >
                          <span className="action-icon-heart" aria-hidden="true">♡</span>
                          <span className="action-label">{t.detail?.favorite || 'Yêu thích'}</span>
                        </button>
                        <span className="fav-mini-sep" aria-hidden="true">&amp;</span>
                        <button
                          type="button"
                          className={`fav-mini ${isInCollection ? 'is-active' : ''}`}
              onClick={handleToggleCollection}
                        >
                          <span className="action-icon-folder" aria-hidden="true">📁</span>
                          <span className="action-label">{t.detail?.collection || 'Bộ sưu tập'}</span>
                        </button>
                      </div>
                    <button className="venue-action" onClick={() => setShowCommentModal(true)}>
                      <span className="action-icon" aria-hidden="true">💬</span>
                      <span className="action-label">{t.detail?.comment || 'Bình luận'}</span>
                    </button>
                    <button className="venue-action" onClick={() => setShowImageModal(true)}>
                      <span className="action-icon" aria-hidden="true">🖼️</span>
                      <span className="action-label">{t.detail?.photos || 'Hình ảnh'}</span>
                    </button>
                    <button
                      className="venue-action"
                      type="button"
                      onClick={() => setShowShareModal(true)}
                    >
                      <span className="action-icon" aria-hidden="true">🔗</span>
                      <span className="action-label">{t.detail?.share || 'Chia sẻ'}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="venue-summary-row">
                <span className="venue-price-range">{priceLabel}</span>
              </div>
              <div className="venue-summary-row venue-hours-row">
                <span className={`venue-open-chip ${isOpenNow ? '' : 'is-closed'}`}>
                  {isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}
                </span>
                <span className="venue-hours-text">
                  {`${defaultStartTime} - ${defaultEndTime}`}
                  <button
                    type="button"
                    className="venue-hours-info"
                    aria-label="Xem giờ hoạt động chi tiết"
                    onClick={() => setShowHoursModal(true)}
                  >
                    ⓘ
                  </button>
                </span>
              </div>
              <div className="venue-summary-row venue-summary-rating-row">
                <span className="venue-rating">⭐ {rating.toFixed(1)}</span>
                <span className="venue-rating-count">({reviewCount} {t.detail?.reviews || 'reviews'})</span>
              </div>
            </div>
          </div>
          <button
            className="venue-report-corner"
            type="button"
            onClick={() => navigate(APP_ROUTES.FEEDBACK)}
          >
            🚩 Report
          </button>
        </div>
      </section>

      <section className="venue-gallery-section">
        <h3>Photos</h3>
        {reviewPhotos.length === 0 ? (
          <p className="venue-gallery-empty">Chưa có hình ảnh.</p>
        ) : (
          <div className="venue-gallery-grid">
            {reviewPhotos.slice(0, 6).map((img, idx) => (
              <img key={idx} src={img} alt="gallery" />
            ))}
            {reviewPhotos.length > 6 && (
              <button type="button" className="gallery-more" onClick={() => setShowImageModal(true)}>
                +{reviewPhotos.length - 6}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="venue-review-list">
        <h3>Reviews</h3>
        {reviews.map((review) => {
          const reviewKey = review.id ?? review.localId;

          return (
            <div key={reviewKey} className="review-card">
            <div className="review-header">
              <div>
                <p className="review-author">{review.author || user?.fullname || 'Khách'}</p>
                <p className="review-device">
                  {formatReviewDate(review.date || review.createdAt || review.created_at)}
                </p>
              </div>
              <div className="review-rating">{'⭐'.repeat(review.rating || 0)}</div>
            </div>
            {review.title && <h4 className="review-title">{review.title}</h4>}
            <p className="review-content">{review.content}</p>
            {(review.photos || []).length > 0 && (
              <div className="review-photos">
                {review.photos.map((photo, idx) => (
                  <img key={idx} src={photo} alt="review" />
                ))}
              </div>
            )}
            {(review.videos || []).length > 0 && (
              <div className="review-videos">
                {review.videos.map((video, idx) => (
                  <video key={idx} className="review-video" controls src={video} />
                ))}
              </div>
            )}
            <div className="review-actions">
              <button
                type="button"
                  className={`review-action ${likedReviewIds.has(reviewKey) ? 'is-active' : ''}`}
                  onClick={() => handleToggleReviewLike(reviewKey)}
              >
                  <span className="review-action-icon">👍</span>
                Like ({likedReviewIds.has(reviewKey) ? (review.likeCount || 0) + 1 : review.likeCount || 0})
              </button>
              <button
                type="button"
                className="review-action ghost"
                  onClick={() => openReplyModal(reviewKey)}
              >
                <span className="review-action-icon">💬</span>
                  Bình luận ({(review.replies || []).length})
              </button>
              <button
                type="button"
                className="review-action"
                onClick={() => navigate(APP_ROUTES.FEEDBACK)}
              >
                <span className="review-action-icon">🚩</span>
                Báo lỗi
              </button>
              {((review.user_id || review.userId || review.user?.id) && user?.id
                ? String(review.user_id || review.userId || review.user?.id) === String(user.id)
                : review.author && user?.fullname && review.author === user.fullname) && (
                <button
                  type="button"
                  className="review-action danger"
                    onClick={() => handleDeleteReview(reviewKey)}
                >
                  <span className="review-action-icon">🗑️</span>
                  Xoá
                </button>
              )}
            </div>

              {(review.replies || []).length > 0 && (
                <div className="reply-list">
                      {review.replies.map((reply) => (
                        <div key={reply.id} className="review-reply">
                          <div className="reply-meta">
                            <span className="reply-author">{reply.author || 'Khách'}</span>
                            <span className="reply-date">{formatReviewDate(reply.date)}</span>
                            {reply.rating ? (
                              <span className="reply-rating">{'⭐'.repeat(Number(reply.rating) || 0)}</span>
                            ) : null}
                          </div>
                          {reply.title && <h5 className="reply-title">{reply.title}</h5>}
                          <p className="reply-content">{reply.content}</p>
                          {(reply.photos || []).length > 0 && (
                            <div className="reply-media-grid">
                              {reply.photos.map((photo, idx) => (
                                <img key={`rphoto-${idx}`} src={photo} alt="reply" />
                              ))}
                            </div>
                          )}
                          {(reply.videos || []).length > 0 && (
                            <div className="reply-media-grid videos">
                              {reply.videos.map((video, idx) => (
                                <video key={`rvideo-${idx}`} src={video} controls />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                </div>
              )}

          </div>
          );
        })}
      </section>

      {showCommentModal && (
        <div className="venue-modal" onClick={() => setShowCommentModal(false)}>
          <div className="venue-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Viết Bình Luận</h3>
              <button className="venue-modal-close" onClick={() => setShowCommentModal(false)}>
                ✕
              </button>
            </div>
            {commentFormError && (
              <div className="comment-form-error">
                ⚠️ {commentFormError}
              </div>
            )}
            <form className="comment-form figma-form" onSubmit={handleSubmitReview}>
              <div className="figma-form-left">
                <button
                  type="button"
                  className="media-drop"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <span className="media-icon">📷</span>
                  <span>Ảnh & Video</span>
                  <span className="media-hint">Chọn từ thiết bị</span>
                  <span className="media-count">
                    {(newReview.photos?.length || 0) + (newReview.videos?.length || 0)} file
                  </span>
                  {(newReview.photos?.length > 0 || newReview.videos?.length > 0) && (
                    <div className="media-preview-inline" onClick={(e) => e.stopPropagation()}>
                      {newReview.photos.map((photo, index) => (
                        <div key={`photo-${index}`} className="media-thumb">
                          <button
                            type="button"
                            className="media-remove"
                            onClick={() => handleRemoveMedia('photos', index)}
                            title="Xoá ảnh"
                          >
                            −
                          </button>
                          <img src={photo} alt="preview" />
                        </div>
                      ))}
                      {newReview.videos.map((video, index) => (
                        <div key={`video-${index}`} className="media-thumb">
                          <button
                            type="button"
                            className="media-remove"
                            onClick={() => handleRemoveMedia('videos', index)}
                            title="Xoá video"
                          >
                            −
                          </button>
                          <video src={video} />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  hidden
                />
              </div>

              <div className="figma-form-right">
                <div className="comment-field">
                  <label>Đánh giá sao</label>
                  <div className="comment-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-button ${newReview.rating >= star ? 'is-active' : ''}`}
                        onClick={() => setNewReview((prev) => ({ ...prev, rating: star }))}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="comment-field">
                  <label>Tiêu đề</label>
                  <input
                    type="text"
                    placeholder="Tiêu đề"
                    value={newReview.title}
                    onChange={(e) =>
                      setNewReview((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>

                <div className="comment-field">
                  <label>Mô tả chi tiết bình luận ...</label>
                  <textarea
                    placeholder="Mô tả chi tiết bình luận ..."
                    value={newReview.content}
                    onChange={(e) =>
                      setNewReview((prev) => ({ ...prev, content: e.target.value }))
                    }
                  />
                </div>

                <div className="figma-actions">
                  <button type="submit" className="venue-action is-active">
                    Bình luận
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="venue-modal" onClick={() => setShowImageModal(false)}>
          <div className="venue-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Hình ảnh</h3>
              <button className="venue-modal-close" onClick={() => setShowImageModal(false)}>
                ✕
              </button>
            </div>
            <div className="venue-gallery-grid">
              {reviewPhotos.length === 0 && <p>Chưa có hình ảnh.</p>}
              {reviewPhotos.map((img, idx) => (
                <div key={idx} className="gallery-thumb">
                  <img src={img} alt="review" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="venue-modal" onClick={() => setShowShareModal(false)}>
          <div
            className="venue-modal-card share-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="venue-modal-header">
              <h3>Chia sẻ</h3>
              <button className="venue-modal-close" onClick={() => setShowShareModal(false)}>
                ✕
              </button>
            </div>
            <div className="share-body">
              <p className="share-lead">Vui lòng chọn hình thức chia sẻ</p>
              <div className="share-grid">
                <button
                  type="button"
                  className="share-btn fb"
                  onClick={() =>
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        shareUrl
                      )}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  f
                  <span className="sr-only">Chia sẻ Facebook</span>
                </button>
                <button
                  type="button"
                  className="share-btn gg"
                  onClick={() =>
                    window.open(
                      `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(
                        'Chia sẻ địa điểm'
                      )}&body=${encodeURIComponent(shareUrl)}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  G
                  <span className="sr-only">Chia sẻ qua Google</span>
                </button>
              </div>

              <div className="share-link-row">
                <input
                  className="share-link-input"
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`copy-btn ${copyStatus === 'copied' ? 'is-copied' : ''}`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopyStatus('copied');
                      setTimeout(() => setCopyStatus(''), 1400);
                    } catch (err) {
                      console.error(err);
                      window.prompt('Sao chép liên kết bên dưới để chia sẻ:', shareUrl);
                    }
                  }}
                >
                  {copyStatus === 'copied' ? 'Đã copy' : 'Copy link'}
                </button>
              </div>
              {copyStatus === 'copied' && <div className="copy-feedback">Đã sao chép ✔</div>}
            </div>
          </div>
        </div>
      )}

      {showFavoriteModal && (
        <div className="venue-modal" onClick={() => setShowFavoriteModal(false)}>
          <div className="venue-modal-card hours-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Đã thêm vào Yêu thích</h3>
              <button className="venue-modal-close" onClick={() => setShowFavoriteModal(false)}>
                ✕
              </button>
            </div>
            <p>Địa điểm đã được thêm vào danh sách yêu thích của bạn.</p>
          </div>
        </div>
      )}

      {showCollectionModal && (
        <div className="venue-modal" onClick={() => setShowCollectionModal(false)}>
          <div className="venue-modal-card hours-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Đã thêm vào Bộ sưu tập</h3>
              <button className="venue-modal-close" onClick={() => setShowCollectionModal(false)}>
                ✕
              </button>
            </div>
            <p>Địa điểm đã được thêm vào bộ sưu tập của bạn.</p>
          </div>
        </div>
      )}

      {showHoursModal && (
        <div className="venue-modal" onClick={() => setShowHoursModal(false)}>
          <div className="venue-modal-card hours-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Giờ hoạt động</h3>
              <button className="venue-modal-close" onClick={() => setShowHoursModal(false)}>
                ✕
              </button>
            </div>
            <div className="hours-grid">
              {weeklyHours.map((day, idx) => (
                <div key={day.key} className={`hours-row ${isOpenNow && idx === ((new Date().getDay() + 6) % 7) ? 'is-today' : ''}`}>
                  <span className="hours-day">{day.label}</span>
                  <span className="hours-time">{day.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showReplyModal && (
        <div className="venue-modal" onClick={() => setShowReplyModal(false)}>
          <div className="venue-modal-card reply-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="venue-modal-header">
              <h3>Bình luận</h3>
              <button className="venue-modal-close" onClick={() => setShowReplyModal(false)}>
                ✕
              </button>
            </div>
            {replyFormError && (
              <div className="comment-form-error">
                ⚠️ {replyFormError}
              </div>
            )}

            <div className="comment-form figma-form reply-form">
              <div className="figma-form-left">
                <button
                  type="button"
                  className="media-drop"
                  onClick={() => replyUploadRef.current?.click()}
                >
                  <span className="media-icon">📷</span>
                  <span>Ảnh &amp; Video</span>
                  <span className="media-hint">Chọn từ thiết bị</span>
                  {(replyMedia.photos?.length || 0) + (replyMedia.videos?.length || 0) > 0 && (
                    <span className="media-count">
                      {(replyMedia.photos?.length || 0) + (replyMedia.videos?.length || 0)} file
                    </span>
                  )}
                  {(replyMedia.photos?.length > 0 || replyMedia.videos?.length > 0) && (
                    <div className="media-preview-inline" onClick={(e) => e.stopPropagation()}>
                      {replyMedia.photos.map((photo, index) => (
                        <div key={`reply-photo-${index}`} className="media-thumb">
                          <button
                            type="button"
                            className="media-remove"
                            onClick={() => handleRemoveReplyMedia('photos', index)}
                            title="Xoá ảnh"
                          >
                            −
                          </button>
                          <img src={photo} alt="preview" />
                        </div>
                      ))}
                      {replyMedia.videos.map((video, index) => (
                        <div key={`reply-video-${index}`} className="media-thumb">
                          <button
                            type="button"
                            className="media-remove"
                            onClick={() => handleRemoveReplyMedia('videos', index)}
                            title="Xoá video"
                          >
                            −
                          </button>
                          <video src={video} />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
                <input
                  ref={replyUploadRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleReplyMediaUpload}
                  hidden
                />
              </div>

              <div className="figma-form-right">
                <div className="comment-field">
                  <label>Đánh giá sao</label>
                  <div className="comment-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-button ${replyForm.rating >= star ? 'is-active' : ''}`}
                        onClick={() => setReplyForm((prev) => ({ ...prev, rating: star }))}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="comment-field">
                  <label>Tiêu đề</label>
                  <input
                    type="text"
                    placeholder="Tiêu đề"
                    value={replyForm.title}
                    onChange={(e) => setReplyForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="comment-field">
                  <label>Nhập bình luận phản hồi...</label>
                  <textarea
                    rows={3}
                    placeholder="Nhập bình luận phản hồi..."
                    value={replyDrafts[replyParentId] || ''}
                    onChange={(e) => handleReplyDraftChange(replyParentId, e.target.value)}
                  />
                </div>

                <div className="figma-actions">
                  <button
                    type="button"
                    className="venue-action is-active"
                    onClick={() => handleSubmitReply(replyParentId)}
                  >
                    Gửi bình luận
                  </button>
                  <button type="button" className="venue-action ghost" onClick={() => setShowReplyModal(false)}>
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VenueDetailPage;


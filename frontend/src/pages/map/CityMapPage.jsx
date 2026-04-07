import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useLocation, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { APP_ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { submitFeedback } from '../../services/feedbackService';
import { fetchMerchantServices } from '../../services/api/merchantServicesApi';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import {
  createVenueReview,
  createVenueReviewReply,
  fetchVenueCommunityBundle,
  fetchVenueDetails,
  fetchVenueReviews,
  fetchVenues,
  toggleVenueReviewLike,
  toggleVenueReviewReplyLike,
} from '../../services/api/venuesApi';
import { fetchWards } from '../../services/api/wardsApi';
import {
  DEFAULT_CITY_CENTER,
  extractVenueEmail,
  extractVenueImages,
  extractVenueServiceNames,
  extractVenueWeeklySchedule,
  formatPriceRange,
  mapCenterFromWards,
  normalizeVenues,
  normalizeWards,
  resolveVenueCategoryId,
  resolveVenueCategoryName,
  resolveVenueName,
  resolveVenueRating,
  resolveWardName,
} from '../../components/map/cityMapUtils';
import translations from '../../constants/translations';
import './CityMapPage.css';

const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80';
const CATEGORY_COLOR_PALETTE = ['#0f766e', '#ca8a04', '#be185d', '#9333ea', '#b45309', '#65a30d', '#9a3412'];
const markerCache = new Map();

const userLocationIcon = L.divIcon({
  className: 'city-map-user-pin',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function hashCategoryId(value) {
  const text = String(value || 'default');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function resolveCategoryColor(categoryId) {
  return CATEGORY_COLOR_PALETTE[hashCategoryId(categoryId) % CATEGORY_COLOR_PALETTE.length];
}

function buildCategoryIcon(categoryId, emoji) {
  const normalizedEmoji = typeof emoji === 'string' && emoji.trim() ? emoji.trim() : '📍';
  const color = resolveCategoryColor(categoryId);
  const cacheKey = `${String(categoryId)}-${normalizedEmoji}`;

  if (!markerCache.has(cacheKey)) {
    markerCache.set(
      cacheKey,
      L.divIcon({
        className: 'city-map-category-pin',
        html: `<span style="background:${color}">${normalizedEmoji}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -14],
      })
    );
  }

  return markerCache.get(cacheKey);
}

function resolveVenuePopupImage(venue, apiBase) {
  const imageCandidates = [
    venue?.venue_primary_image_url,
    ...(Array.isArray(venue?.venue_images) ? venue.venue_images : []),
    venue?.cover_image_url,
    venue?.coverImageUrl,
    venue?.image,
  ];

  for (const candidate of imageCandidates) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    if (normalized) {
      return resolveAssetUrl(normalized, apiBase);
    }
  }

  return FALLBACK_VENUE_IMAGE;
}

function buildImageIdentity(url) {
  const normalized = String(url || '').trim();
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      return `${parsed.pathname}${parsed.search || ''}`;
    } catch {
      return normalized;
    }
  }

  return normalized;
}

function resolveUniqueAssetUrls(urls, apiBase) {
  const mapped = urls
    .map((item) => resolveAssetUrl(item, apiBase))
    .filter(Boolean);

  const identityMap = new Map();
  mapped.forEach((item) => {
    const key = buildImageIdentity(item);
    if (!key || identityMap.has(key)) {
      return;
    }

    identityMap.set(key, item);
  });

  return [...identityMap.values()];
}

function normalizeHalfStarRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const bounded = Math.max(0, Math.min(5, parsed));
  return Math.round(bounded * 2) / 2;
}

function resolveStarDisplayItems(rating) {
  const normalized = normalizeHalfStarRating(rating);
  const fullStars = Math.floor(normalized);
  const hasHalfStar = normalized - fullStars >= 0.5;

  return Array.from({ length: 5 }, (_item, index) => {
    const starNumber = index + 1;
    if (starNumber <= fullStars) {
      return 'full';
    }

    if (hasHalfStar && starNumber === fullStars + 1) {
      return 'half';
    }

    return 'empty';
  });
}

function resolveHalfStarSelection(event, starValue) {
  if (!event?.currentTarget) {
    return normalizeHalfStarRating(starValue);
  }

  const targetRect = event.currentTarget.getBoundingClientRect();
  const pointerX = event.clientX - targetRect.left;
  const pickedValue = pointerX <= targetRect.width / 2 ? starValue - 0.5 : starValue;
  return normalizeHalfStarRating(pickedValue);
}

function StarRatingDisplay({ rating, className = '' }) {
  const starItems = resolveStarDisplayItems(rating);

  return (
    <span className={`city-map-star-display ${className}`.trim()} aria-label={`${normalizeHalfStarRating(rating)} trên 5 sao`}>
      {starItems.map((starType, index) => (
        <span key={`city-map-star-${index + 1}`} className={`city-map-star-display-item is-${starType}`} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

const VENUE_REPORT_REASON_OPTIONS = [
  { value: 'incorrect_info', label: 'Thông tin sai' },
  { value: 'spam_ads', label: 'Spam / quảng cáo' },
  { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
  { value: 'duplicate', label: 'Trùng lặp' },
  { value: 'other', label: 'Khác' },
];

const REVIEW_REPORT_REASON_OPTIONS = [
  { value: 'inappropriate_language', label: 'Ngôn từ không phù hợp' },
  { value: 'spam_ads', label: 'Spam / quảng cáo' },
  { value: 'incorrect_info', label: 'Thông tin không đúng' },
  { value: 'other', label: 'Khác' },
];

const REPORT_SEVERITY_OPTIONS = [
  { value: 'low', label: 'Thấp', stars: '★' },
  { value: 'medium', label: 'Trung bình', stars: '★★' },
  { value: 'high', label: 'Nghiêm trọng', stars: '★★★' },
];

function formatReviewDateTime(value) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeReviewReplies(value, apiBase) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((reply) => ({
    id: reply?.id,
    authorName: String(reply?.author_name || reply?.authorName || '').trim() || 'Anonymous',
    rating: Number(reply?.rating || 0),
    title: String(reply?.title || '').trim(),
    content: String(reply?.content || reply?.comment || '').trim(),
    likeCount: Number(reply?.like_count || reply?.likeCount || 0),
    likedByMe: Boolean(reply?.liked_by_me || reply?.likedByMe),
    createdAt: reply?.created_at || reply?.createdAt || null,
    imageUrls: resolveUniqueAssetUrls(
      normalizeImageUrlList(reply?.image_urls || reply?.imageUrls),
      apiBase
    ),
  }));
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeImageUrlList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (typeof item === 'string') {
        return [item];
      }

      if (item && typeof item === 'object') {
        return [item.url, item.image_url, item.imageUrl, item.src, item.path].filter(
          (candidate) => typeof candidate === 'string'
        );
      }

      return [];
    })
    .map((item) => item.trim())
    .filter((item) => {
      const normalized = String(item || '').trim().toLowerCase();
      const hasValidImagePath =
        /^https?:\/\//i.test(normalized)
        || normalized.startsWith('/uploads/')
        || normalized.startsWith('uploads/')
        || normalized.startsWith('data:image/')
        || normalized.startsWith('data:video/');

      return Boolean(normalized) && hasValidImagePath && !['nan', 'null', 'undefined'].includes(normalized);
    });
}

function resolveAssetUrl(url, apiBase) {
  const normalized = String(url || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^['"]|['"]$/g, '');

  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase().startsWith('data:image/') || normalized.toLowerCase().startsWith('data:video/')) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith('/api/uploads/')) {
        parsed.pathname = parsed.pathname.replace(/^\/api/, '');
      }

      return parsed.toString();
    } catch {
      return normalized;
    }
  }

  const normalizedWithoutApiPrefix = normalized
    .replace(/^\/?api\/uploads\//i, '/uploads/')
    .replace(/^\.\//, '');

  if (normalizedWithoutApiPrefix.startsWith('/')) {
    return `${apiBase}${normalizedWithoutApiPrefix}`;
  }

  return `${apiBase}/${normalizedWithoutApiPrefix}`;
}

function isVideoAssetUrl(url) {
  const normalized = String(url || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('data:video/')) {
    return true;
  }

  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(normalized);
}

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    const latitude = Number(center?.[0]);
    const longitude = Number(center?.[1]);
    const hasValidCenter =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    if (hasValidCenter) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center, zoom]);

  return null;
}

function toPolygonBoundaryFeatureCollection(boundary) {
  if (!boundary || typeof boundary !== 'object') {
    return null;
  }

  const features =
    boundary.type === 'FeatureCollection' && Array.isArray(boundary.features)
      ? boundary.features
      : boundary.type === 'Feature'
        ? [boundary]
        : [];

  const polygonFeatures = features.filter((feature) => {
    const geometryType = feature?.geometry?.type;
    return geometryType === 'Polygon' || geometryType === 'MultiPolygon';
  });

  if (!polygonFeatures.length) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: polygonFeatures,
  };
}

function CityMapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.vi;
  const apiUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', []);
  const apiBase = useMemo(() => apiUrl.replace(/\/api\/v1$|\/api$/i, ''), [apiUrl]);
  const [loadingBaseData, setLoadingBaseData] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [error, setError] = useState('');

  const [wards, setWards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [venues, setVenues] = useState([]);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedWardIds, setSelectedWardIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');

  const [appliedCategoryIds, setAppliedCategoryIds] = useState([]);
  const [appliedWardIds, setAppliedWardIds] = useState([]);
  const [appliedServiceIds, setAppliedServiceIds] = useState([]);
  const [appliedSearch, setAppliedSearch] = useState('');

  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedVenueDetail, setSelectedVenueDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [loadingVenueDetail, setLoadingVenueDetail] = useState(false);
  const [venueDetailError, setVenueDetailError] = useState('');
  const [venueReviews, setVenueReviews] = useState([]);
  const [loadingVenueReviews, setLoadingVenueReviews] = useState(false);
  const [venueReviewsError, setVenueReviewsError] = useState('');
  const [venueReviewSort, setVenueReviewSort] = useState('newest');
  const [venueReviewStats, setVenueReviewStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [venueReviewForm, setVenueReviewForm] = useState({ rating: null, title: '', comment: '', mediaFiles: [] });
  const [submittingVenueReview, setSubmittingVenueReview] = useState(false);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState(null);
  const [venueReplyForm, setVenueReplyForm] = useState({ rating: null, title: '', content: '' });
  const [submittingVenueReply, setSubmittingVenueReply] = useState(false);
  const [reviewActionError, setReviewActionError] = useState('');
  const [reviewFormError, setReviewFormError] = useState('');
  const [venueReviewsRefreshKey, setVenueReviewsRefreshKey] = useState(0);
  const [venueReviewImages, setVenueReviewImages] = useState([]);
  const [loadingVenueReviewImages, setLoadingVenueReviewImages] = useState(false);
  const [venueReviewImagesError, setVenueReviewImagesError] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoPreviewAlt, setPhotoPreviewAlt] = useState('');
  const [showVenueReportModal, setShowVenueReportModal] = useState(false);
  const [showReviewReportModal, setShowReviewReportModal] = useState(false);
  const [activeReviewToReport, setActiveReviewToReport] = useState(null);
  const [submittingVenueReport, setSubmittingVenueReport] = useState(false);
  const [submittingReviewReport, setSubmittingReviewReport] = useState(false);
  const [venueReportStatus, setVenueReportStatus] = useState({ type: '', message: '' });
  const [reviewReportStatus, setReviewReportStatus] = useState({ type: '', message: '' });
  const [venueReportForm, setVenueReportForm] = useState({
    reason: '',
    description: '',
    severity: 'low',
    attachment: null,
  });
  const [reviewReportForm, setReviewReportForm] = useState({
    reason: 'inappropriate_language',
    description: '',
    attachment: null,
  });

  const [mapCenter, setMapCenter] = useState(DEFAULT_CITY_CENTER);
  const [mapZoom, setMapZoom] = useState(13);
  const [useFallbackBaseTiles, setUseFallbackBaseTiles] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [queryFocusVenueId, setQueryFocusVenueId] = useState('');
  const [queryFocusCoordinates, setQueryFocusCoordinates] = useState(null);
  const [popupVenueIdToOpen, setPopupVenueIdToOpen] = useState('');
  const venueMarkerRefs = useRef(new Map());
  const authToken = useMemo(() => String(token || '').replace(/^Bearer\s+/i, '').trim(), [token]);

  const wardById = useMemo(
    () => new Map(wards.map((ward) => [String(ward.ward_id), ward])),
    [wards]
  );

  const categoryById = useMemo(
    () =>
      new Map(
        categories
          .map((category) => [Number(category.id), category])
          .filter(([categoryId]) => Number.isInteger(categoryId))
      ),
    [categories]
  );

  const serviceNameById = useMemo(
    () =>
      new Map(
        services
          .map((service) => [Number(service.id), service.name])
          .filter(([serviceId, serviceName]) => Number.isInteger(serviceId) && Boolean(serviceName))
      ),
    [services]
  );

  const selectedVenueFromList = useMemo(
    () => venues.find((venue) => Number(venue.id) === Number(selectedVenueId)) || null,
    [venues, selectedVenueId]
  );

  const selectedVenue = useMemo(() => {
    if (selectedVenueDetail && Number(selectedVenueDetail.id) === Number(selectedVenueId)) {
      return selectedVenueDetail;
    }

    return selectedVenueFromList;
  }, [selectedVenueDetail, selectedVenueFromList, selectedVenueId]);

  const selectedVenueImages = useMemo(() => {
    if (!selectedVenue) {
      return [];
    }

    const apiVenueImages = Array.isArray(selectedVenue.venue_images)
      ? selectedVenue.venue_images
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      : [];

    const fallbackVenueImages = apiVenueImages.length ? [] : extractVenueImages(selectedVenue);

    const mergedImages = resolveUniqueAssetUrls([...apiVenueImages, ...fallbackVenueImages], apiBase);

    if (mergedImages.length) {
      return [...new Set(mergedImages)];
    }

    return [resolveVenuePopupImage(selectedVenue, apiBase) || FALLBACK_VENUE_IMAGE];
  }, [apiBase, selectedVenue]);

  const selectedVenueServices = useMemo(
    () => (selectedVenue ? extractVenueServiceNames(selectedVenue, serviceNameById) : []),
    [selectedVenue, serviceNameById]
  );

  const selectedVenueSchedule = useMemo(
    () => (selectedVenue ? extractVenueWeeklySchedule(selectedVenue) : []),
    [selectedVenue]
  );

  const selectedWardSet = useMemo(() => new Set(appliedWardIds), [appliedWardIds]);
  const normalizedAppliedSearch = useMemo(() => normalizeSearchText(appliedSearch), [appliedSearch]);
  const venueReportAttachmentPreview = useMemo(() => {
    const attachment = venueReportForm.attachment;
    if (!attachment || !String(attachment.type || '').startsWith('image/')) {
      return '';
    }

    return URL.createObjectURL(attachment);
  }, [venueReportForm.attachment]);
  const reviewReportAttachmentPreview = useMemo(() => {
    const attachment = reviewReportForm.attachment;
    if (!attachment || !String(attachment.type || '').startsWith('image/')) {
      return '';
    }

    return URL.createObjectURL(attachment);
  }, [reviewReportForm.attachment]);

  const selectedVenueRatingValue = useMemo(
    () => Number(venueReviewStats.averageRating || resolveVenueRating(selectedVenue) || 0),
    [selectedVenue, venueReviewStats.averageRating]
  );

  const selectedVenueReviewCount = useMemo(() => {
    const fallbackCount = Number(
      selectedVenue?.total_reviews ||
      selectedVenue?.totalReviews ||
      selectedVenue?.review_count ||
      selectedVenue?.reviewCount ||
      0
    );

    return Number(venueReviewStats.totalReviews || fallbackCount || 0);
  }, [selectedVenue, venueReviewStats.totalReviews]);
  const reviewMediaPreviews = useMemo(
    () =>
      (Array.isArray(venueReviewForm.mediaFiles) ? venueReviewForm.mediaFiles : []).map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        url: URL.createObjectURL(file),
        isVideo: String(file.type || '').toLowerCase().startsWith('video/'),
      })),
    [venueReviewForm.mediaFiles]
  );

  const activeFilterCount =
    appliedCategoryIds.length + appliedWardIds.length + appliedServiceIds.length + (appliedSearch ? 1 : 0);

  useEffect(() => {
    return () => {
      if (venueReportAttachmentPreview) {
        URL.revokeObjectURL(venueReportAttachmentPreview);
      }

      if (reviewReportAttachmentPreview) {
        URL.revokeObjectURL(reviewReportAttachmentPreview);
      }
    };
  }, [venueReportAttachmentPreview, reviewReportAttachmentPreview]);

  const syncVenueRatingStats = (targetVenueId, averageRating, totalReviews) => {
    const numericVenueId = Number(targetVenueId);
    if (!Number.isFinite(numericVenueId)) {
      return;
    }

    const normalizedRating = normalizeHalfStarRating(averageRating);
    const normalizedTotalReviews = Math.max(0, Number(totalReviews || 0));

    setVenueReviewStats({
      averageRating: normalizedRating,
      totalReviews: normalizedTotalReviews,
    });

    setSelectedVenueDetail((current) => {
      if (!current || Number(current.id) !== numericVenueId) {
        return current;
      }

      return {
        ...current,
        average_rating: normalizedRating,
        averageRating: normalizedRating,
        rating: normalizedRating,
        total_reviews: normalizedTotalReviews,
        totalReviews: normalizedTotalReviews,
        review_count: normalizedTotalReviews,
        reviewCount: normalizedTotalReviews,
      };
    });

    setVenues((previousVenues) =>
      previousVenues.map((venueItem) => {
        if (Number(venueItem.id) !== numericVenueId) {
          return venueItem;
        }

        return {
          ...venueItem,
          average_rating: normalizedRating,
          averageRating: normalizedRating,
          rating: normalizedRating,
          total_reviews: normalizedTotalReviews,
          totalReviews: normalizedTotalReviews,
          review_count: normalizedTotalReviews,
          reviewCount: normalizedTotalReviews,
        };
      })
    );
  };

  const filterParams = useMemo(() => {
    const params = { status: 'approved', compact: 'true' };

    if (queryFocusVenueId) {
      params.venueId = queryFocusVenueId;
    }

    if (appliedCategoryIds.length) {
      params.categoryIds = appliedCategoryIds.join(',');
    }

    if (appliedWardIds.length) {
      params.wardIds = appliedWardIds.join(',');
    }

    if (appliedServiceIds.length) {
      params.serviceIds = appliedServiceIds.join(',');
    }

    return params;
  }, [appliedCategoryIds, appliedWardIds, appliedServiceIds, queryFocusVenueId]);

  const displayedVenues = useMemo(() => {
    const venuesWithValidCoordinates = venues.filter((venue) => {
      const latitude = Number(venue?.latitude);
      const longitude = Number(venue?.longitude);
      return Number.isFinite(latitude) && Number.isFinite(longitude);
    });

    if (!normalizedAppliedSearch) {
      return venuesWithValidCoordinates;
    }

    return venuesWithValidCoordinates.filter((venue) =>
      normalizeSearchText(resolveVenueName(venue)).includes(normalizedAppliedSearch)
    );
  }, [venues, normalizedAppliedSearch]);

  const safeMapCenter = useMemo(() => {
    const lat = Number(mapCenter?.[0]);
    const lng = Number(mapCenter?.[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return DEFAULT_CITY_CENTER;
    }

    return [lat, lng];
  }, [mapCenter]);

  const requestCurrentPosition = (recenterMap = false) => {
    if (!navigator.geolocation) {
      return;
    }

    setLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition = [position.coords.latitude, position.coords.longitude];
        setCurrentPosition(nextPosition);

        if (recenterMap) {
          setMapCenter(nextPosition);
          setMapZoom(15);
        }

        setLocatingUser(false);
      },
      () => {
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    requestCurrentPosition(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    const venueId = String(params.get('venueId') || '').trim();

    const hasValidQueryCoordinates =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    if (hasValidQueryCoordinates) {
      setMapCenter([lat, lng]);
      setMapZoom(17);
      setQueryFocusCoordinates([lat, lng]);
    } else {
      setQueryFocusCoordinates(null);
    }

    setQueryFocusVenueId(venueId);
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      setLoadingBaseData(true);
      setError('');

      try {
        const [wardData, categoryData, serviceData] = await Promise.all([
          fetchWards(),
          fetchPlaceCategories(),
          fetchMerchantServices(),
        ]);

        if (!isMounted) {
          return;
        }

        const normalizedWards = normalizeWards(wardData);
        setWards(normalizedWards);
        setMapCenter((currentCenter) => {
          const params = new URLSearchParams(location.search || '');
          const lat = Number(params.get('lat'));
          const lng = Number(params.get('lng'));

          const hasValidQueryCoordinates =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180;

          if (hasValidQueryCoordinates) {
            return currentCenter;
          }

          return mapCenterFromWards(normalizedWards);
        });
        setCategories(Array.isArray(categoryData) ? categoryData.filter((item) => item.is_active !== false) : []);
        setServices(Array.isArray(serviceData) ? serviceData.filter((item) => item.is_active !== false) : []);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.response?.data?.message || 'Could not load map filters right now.');
        setWards([]);
        setCategories([]);
        setServices([]);
      } finally {
        if (isMounted) {
          setLoadingBaseData(false);
        }
      }
    }

    loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;

    async function loadVenues() {
      setLoadingVenues(true);
      setError('');

      try {
        const venueData = await fetchVenues(filterParams);

        if (!isMounted) {
          return;
        }

        setVenues(normalizeVenues(venueData));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.response?.data?.message || 'Could not load venues for this map view.');
        setVenues([]);
      } finally {
        if (isMounted) {
          setLoadingVenues(false);
        }
      }
    }

    loadVenues();

    return () => {
      isMounted = false;
    };
  }, [filterParams]);

  useEffect(() => {
    let pollingInFlight = false;

    const intervalId = window.setInterval(async () => {
      if (pollingInFlight) {
        return;
      }

      pollingInFlight = true;

      try {
        const liveVenueData = await fetchVenues({ ...filterParams, live: 'true' });
        setVenues(normalizeVenues(liveVenueData));
      } catch {
        // Keep map data if one polling cycle fails.
      } finally {
        pollingInFlight = false;
      }
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filterParams]);

  useEffect(() => {
    if (selectedVenueId && !venues.some((venue) => Number(venue.id) === Number(selectedVenueId))) {
      setSelectedVenueId(null);
      setSelectedVenueDetail(null);
      setVenueDetailError('');
    }
  }, [selectedVenueId, venues]);

  useEffect(() => {
    if (!selectedVenueId) {
      setSelectedVenueDetail(null);
      setVenueDetailError('');
      setLoadingVenueDetail(false);
      return;
    }

    let isMounted = true;

    async function loadVenueDetail() {
      setLoadingVenueDetail(true);
      setVenueDetailError('');

      try {
        const detail = await fetchVenueDetails(selectedVenueId);

        if (!isMounted) {
          return;
        }

        setSelectedVenueDetail(detail);
        syncVenueRatingStats(
          selectedVenueId,
          Number(resolveVenueRating(detail) || 0),
          Number(detail?.total_reviews || detail?.totalReviews || detail?.review_count || detail?.reviewCount || 0)
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setVenueDetailError('Could not load complete venue details. Showing summary data only.');
        setSelectedVenueDetail(null);
      } finally {
        if (isMounted) {
          setLoadingVenueDetail(false);
        }
      }
    }

    loadVenueDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedVenueId]);

  useEffect(() => {
    return () => {
      reviewMediaPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [reviewMediaPreviews]);

  useEffect(() => {
    if (!selectedVenueId) {
      return;
    }

    let isMounted = true;

    async function preloadVenueCommunityStats() {
      try {
        const communityBundle = await fetchVenueCommunityBundle(selectedVenueId);

        if (!isMounted) {
          return;
        }

        const bundleAverageRating = Number(
          communityBundle?.stats?.averageRating
          ?? communityBundle?.venue?.average_rating
          ?? communityBundle?.venue?.averageRating
          ?? 0
        );
        const bundleTotalReviews = Number(
          communityBundle?.stats?.totalReviews
          ?? communityBundle?.venue?.total_reviews
          ?? communityBundle?.venue?.totalReviews
          ?? communityBundle?.venue?.review_count
          ?? communityBundle?.venue?.reviewCount
          ?? 0
        );

        syncVenueRatingStats(selectedVenueId, bundleAverageRating, bundleTotalReviews);

        if (communityBundle?.venue && Number(communityBundle.venue.id) === Number(selectedVenueId)) {
          setSelectedVenueDetail((current) => ({
            ...(current || {}),
            ...communityBundle.venue,
          }));
        }
      } catch {
        // Keep existing rating if community stats request fails.
      }
    }

    preloadVenueCommunityStats();

    return () => {
      isMounted = false;
    };
  }, [selectedVenueId]);

  const toggleSelection = (setter) => (value) => {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const applyFilters = () => {
    setAppliedCategoryIds(selectedCategoryIds);
    setAppliedWardIds(selectedWardIds);
    setAppliedServiceIds(selectedServiceIds);
    setAppliedSearch(searchInput.trim());
    setIsFilterPanelOpen(false);

    if (selectedWardIds.length) {
      const selectedWards = selectedWardIds
        .map((wardId) => wardById.get(wardId))
        .filter(Boolean);

      if (selectedWards.length) {
        setMapCenter(mapCenterFromWards(selectedWards));
        setMapZoom(selectedWards.length === 1 ? 14 : 13);
      }
    }
  };

  const clearFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedWardIds([]);
    setSelectedServiceIds([]);
    setAppliedCategoryIds([]);
    setAppliedWardIds([]);
    setAppliedServiceIds([]);
    setSearchInput('');
    setAppliedSearch('');
    setMapCenter(mapCenterFromWards(wards));
    setMapZoom(13);
  };

  const openVenueDetailPanel = (venue, options = {}) => {
    const venueId = Number(venue?.id);
    const optionLatitude = Number(options?.focusLat);
    const optionLongitude = Number(options?.focusLng);
    const venueLatitude = Number(venue?.latitude);
    const venueLongitude = Number(venue?.longitude);
    const latitude = Number.isFinite(optionLatitude) ? optionLatitude : venueLatitude;
    const longitude = Number.isFinite(optionLongitude) ? optionLongitude : venueLongitude;

    if (!Number.isFinite(venueId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setSelectedVenueId(venueId);
    setSelectedVenueDetail(null);
    setVenueReviews([]);
    setVenueReviewsError('');
    setVenueReviewSort('newest');
    const initialReviewCount = Number(
      venue?.total_reviews || venue?.totalReviews || venue?.review_count || venue?.reviewCount || 0
    );
    setVenueReviewStats({
      averageRating: Number(resolveVenueRating(venue) || 0),
      totalReviews: Number.isFinite(initialReviewCount) ? initialReviewCount : 0,
    });
    setVenueReviewForm({ rating: null, title: '', comment: '' });
    setActiveReplyReviewId(null);
    setVenueReplyForm({ rating: null, title: '', content: '' });
    setReviewActionError('');
    setReviewFormError('');
    setVenueReviewImages([]);
    setVenueReviewImagesError('');
    setVenueReportStatus({ type: '', message: '' });
    setReviewReportStatus({ type: '', message: '' });
    setDetailTab('overview');
    setMapCenter([latitude, longitude]);
    setMapZoom(Number.isFinite(Number(options?.mapZoom)) ? Number(options.mapZoom) : 16);

    if (options?.openPopup) {
      setPopupVenueIdToOpen(String(venueId));
    }
  };

  useEffect(() => {
    if (!queryFocusVenueId || !venues.length || selectedVenueId) {
      return;
    }

    const targetVenue = venues.find((venue) => String(venue.id).trim() === queryFocusVenueId);
    if (!targetVenue) {
      return;
    }

    openVenueDetailPanel(targetVenue, {
      focusLat: queryFocusCoordinates?.[0],
      focusLng: queryFocusCoordinates?.[1],
      mapZoom: 17,
      openPopup: true,
    });
    setQueryFocusVenueId('');
    setQueryFocusCoordinates(null);
  }, [queryFocusVenueId, queryFocusCoordinates, venues, selectedVenueId]);

  useEffect(() => {
    if (!popupVenueIdToOpen) {
      return;
    }

    const marker = venueMarkerRefs.current.get(String(popupVenueIdToOpen));
    if (!marker) {
      return;
    }

    marker.openPopup();
    setPopupVenueIdToOpen('');
  }, [displayedVenues, popupVenueIdToOpen]);

  const closeDetailPanel = () => {
    setSelectedVenueId(null);
    setSelectedVenueDetail(null);
    setVenueDetailError('');
    setVenueReviews([]);
    setVenueReviewsError('');
    setVenueReviewStats({ averageRating: 0, totalReviews: 0 });
  setVenueReviewForm({ rating: null, title: '', comment: '', mediaFiles: [] });
    setActiveReplyReviewId(null);
    setVenueReplyForm({ rating: null, title: '', content: '' });
    setReviewActionError('');
    setReviewFormError('');
    setVenueReviewImages([]);
    setVenueReviewImagesError('');
    setShowVenueReportModal(false);
    setShowReviewReportModal(false);
    setActiveReviewToReport(null);
  };

  const focusOnVenueLocation = () => {
    if (!selectedVenue) {
      return;
    }

    const latitude = Number(selectedVenue.latitude);
    const longitude = Number(selectedVenue.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setMapCenter([latitude, longitude]);
    setMapZoom(17);

    const id = String(selectedVenue?.id || '').trim();
    if (id) {
      setPopupVenueIdToOpen(id);
    }
  };

  const openPhotoPreview = (imageUrl, imageAlt) => {
    setPhotoPreviewUrl(imageUrl);
    setPhotoPreviewAlt(imageAlt || 'Venue photo');
  };

  const closePhotoPreview = () => {
    setPhotoPreviewUrl('');
    setPhotoPreviewAlt('');
  };

  const requireAuthForReviewAction = () => {
    if (authToken) {
      return true;
    }

    navigate(APP_ROUTES.LOGIN);
    return false;
  };

  const handleSubmitVenueReview = async (event) => {
    event.preventDefault();

    if (!selectedVenueId) {
      return;
    }

    if (!requireAuthForReviewAction()) {
      return;
    }

    const normalizedComment = String(venueReviewForm.comment || '').trim();
    if (!normalizedComment) {
      setReviewFormError('Vui lòng nhập nội dung bình luận.');
      return;
    }

    setReviewFormError('');
    setReviewActionError('');
    setSubmittingVenueReview(true);

    try {
      const payload = new FormData();
      const normalizedRating = normalizeHalfStarRating(venueReviewForm.rating);
      if (normalizedRating >= 0.5) {
        payload.append('rating', String(normalizedRating));
      }

      payload.append('title', String(venueReviewForm.title || '').trim());
      payload.append('comment', normalizedComment);
      (Array.isArray(venueReviewForm.mediaFiles) ? venueReviewForm.mediaFiles : []).forEach((file) => {
        payload.append('images', file);
      });

      const response = await createVenueReview(selectedVenueId, payload);

      if (response?.stats) {
        syncVenueRatingStats(selectedVenueId, response.stats.averageRating, response.stats.totalReviews);
      }

  setVenueReviewForm({ rating: null, title: '', comment: '', mediaFiles: [] });
      setVenueReviewsRefreshKey((value) => value + 1);
    } catch (submitError) {
      setReviewFormError(submitError?.response?.data?.message || 'Không thể gửi bình luận lúc này.');
    } finally {
      setSubmittingVenueReview(false);
    }
  };

  const handleToggleMapReviewLike = async (review) => {
    if (!selectedVenueId || !review?.id) {
      return;
    }

    if (!requireAuthForReviewAction()) {
      return;
    }

    setReviewActionError('');

    try {
      const response = await toggleVenueReviewLike(selectedVenueId, review.id);
      setVenueReviews((previousReviews) =>
        previousReviews.map((item) =>
          item.id === review.id
            ? {
                ...item,
                likeCount: Number(response?.likeCount || 0),
                likedByMe: Boolean(response?.liked),
              }
            : item
        )
      );
    } catch (requestError) {
      setReviewActionError(requestError?.response?.data?.message || 'Không thể cập nhật lượt thích.');
    }
  };

  const handleToggleMapReplyLike = async (review, reply) => {
    if (!selectedVenueId || !review?.id || !reply?.id) {
      return;
    }

    if (!requireAuthForReviewAction()) {
      return;
    }

    setReviewActionError('');

    try {
      const response = await toggleVenueReviewReplyLike(selectedVenueId, review.id, reply.id);

      setVenueReviews((previousReviews) =>
        previousReviews.map((reviewItem) => {
          if (reviewItem.id !== review.id) {
            return reviewItem;
          }

          return {
            ...reviewItem,
            replies: Array.isArray(reviewItem.replies)
              ? reviewItem.replies.map((replyItem) =>
                  replyItem.id === reply.id
                    ? {
                        ...replyItem,
                        likeCount: Number(response?.likeCount || 0),
                        likedByMe: Boolean(response?.liked),
                      }
                    : replyItem
                )
              : [],
          };
        })
      );
    } catch (requestError) {
      setReviewActionError(requestError?.response?.data?.message || 'Không thể cập nhật lượt thích bình luận nhỏ.');
    }
  };

  const handleOpenReplyComposer = (review, reply = null) => {
    if (!review?.id) {
      return;
    }

    setActiveReplyReviewId(review.id);
    setReviewActionError('');

    const mention = reply?.authorName ? `@${reply.authorName} ` : '';
    setVenueReplyForm({
      rating: null,
      title: '',
      content: mention,
    });
  };

  const handleSubmitVenueReply = async (review) => {
    if (!selectedVenueId || !review?.id) {
      return;
    }

    if (!requireAuthForReviewAction()) {
      return;
    }

    const normalizedContent = String(venueReplyForm.content || '').trim();
    if (!normalizedContent) {
      setReviewActionError('Vui lòng nhập nội dung thảo luận.');
      return;
    }

    setReviewActionError('');
    setSubmittingVenueReply(true);

    try {
      const payload = new FormData();
      const normalizedRating = normalizeHalfStarRating(venueReplyForm.rating);
      if (normalizedRating >= 0.5) {
        payload.append('rating', String(normalizedRating));
      }

      payload.append('title', String(venueReplyForm.title || '').trim());
      payload.append('content', normalizedContent);

      await createVenueReviewReply(selectedVenueId, review.id, payload);

      setVenueReplyForm({ rating: null, title: '', content: '' });
      setActiveReplyReviewId(null);
      setVenueReviewsRefreshKey((value) => value + 1);
    } catch (requestError) {
      setReviewActionError(requestError?.response?.data?.message || 'Không thể gửi thảo luận lúc này.');
    } finally {
      setSubmittingVenueReply(false);
    }
  };

  const openVenueReportModal = () => {
    if (!selectedVenue) {
      return;
    }

    setVenueReportForm({
      reason: '',
      description: '',
      severity: 'low',
      attachment: null,
    });
    setVenueReportStatus({ type: '', message: '' });
    setShowVenueReportModal(true);
  };

  const openReviewReportModal = (review) => {
    if (!review) {
      return;
    }

    setActiveReviewToReport(review);
    setReviewReportForm({
      reason: 'inappropriate_language',
      description: '',
      attachment: null,
    });
    setReviewReportStatus({ type: '', message: '' });
    setShowReviewReportModal(true);
  };

  const handleSubmitVenueReport = async (event) => {
    event.preventDefault();

    if (!selectedVenue) {
      return;
    }

    if (!venueReportForm.reason) {
      setVenueReportStatus({ type: 'error', message: 'Vui lòng chọn lý do báo cáo.' });
      return;
    }

    setSubmittingVenueReport(true);
    setVenueReportStatus({ type: '', message: '' });

    const selectedReasonLabel =
      VENUE_REPORT_REASON_OPTIONS.find((item) => item.value === venueReportForm.reason)?.label || 'Khác';
    const selectedSeverityLabel =
      REPORT_SEVERITY_OPTIONS.find((item) => item.value === venueReportForm.severity)?.label || 'Thấp';

    const descriptionText = String(venueReportForm.description || '').trim();
    const reportMessage = [
      `Báo cáo địa điểm: ${resolveVenueName(selectedVenue)}`,
      `Lý do: ${selectedReasonLabel}`,
      `Mức độ: ${selectedSeverityLabel}`,
      `Địa chỉ: ${selectedVenue.address || 'Không có'}`,
      descriptionText ? `Mô tả chi tiết: ${descriptionText}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await submitFeedback({
        category: 'venue_report',
        message: reportMessage,
        attachment: venueReportForm.attachment || null,
        contactEmail: user?.email || '',
        metadata: {
          contextType: 'venue',
          contextId: selectedVenue?.id,
          venueId: selectedVenue?.id,
          venueName: resolveVenueName(selectedVenue),
          severity: venueReportForm.severity,
        },
      });

      setVenueReportStatus({ type: 'success', message: 'Đã gửi báo cáo địa điểm thành công.' });
      window.setTimeout(() => {
        setShowVenueReportModal(false);
      }, 700);
    } catch (error) {
      setVenueReportStatus({
        type: 'error',
        message: error?.response?.data?.message || 'Không thể gửi báo cáo địa điểm lúc này.',
      });
    } finally {
      setSubmittingVenueReport(false);
    }
  };

  const handleSubmitReviewReport = async (event) => {
    event.preventDefault();

    if (!activeReviewToReport) {
      return;
    }

    if (!reviewReportForm.reason) {
      setReviewReportStatus({ type: 'error', message: 'Vui lòng chọn lý do báo lỗi.' });
      return;
    }

    setSubmittingReviewReport(true);
    setReviewReportStatus({ type: '', message: '' });

    const selectedReasonLabel =
      REVIEW_REPORT_REASON_OPTIONS.find((item) => item.value === reviewReportForm.reason)?.label || 'Khác';
    const detail = String(reviewReportForm.description || '').trim();

    const message = [
      `Báo lỗi bình luận #${activeReviewToReport.id || 'N/A'}`,
      `Lý do: ${selectedReasonLabel}`,
      `Người bình luận: ${activeReviewToReport.authorName || 'Ẩn danh'}`,
      `Nội dung: ${activeReviewToReport.comment || ''}`,
      detail ? `Mô tả chi tiết: ${detail}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await submitFeedback({
        category: 'review_report',
        message,
        attachment: reviewReportForm.attachment || null,
        contactEmail: user?.email || '',
        metadata: {
          contextType: 'review',
          contextId: activeReviewToReport?.id,
          venueId: selectedVenue?.id,
          venueName: resolveVenueName(selectedVenue),
        },
      });

      setReviewReportStatus({ type: 'success', message: 'Đã gửi báo lỗi bình luận thành công.' });
      window.setTimeout(() => {
        setShowReviewReportModal(false);
      }, 700);
    } catch (error) {
      setReviewReportStatus({
        type: 'error',
        message: error?.response?.data?.message || 'Không thể gửi báo lỗi bình luận lúc này.',
      });
    } finally {
      setSubmittingReviewReport(false);
    }
  };

  useEffect(() => {
    if (!selectedVenueId || detailTab !== 'reviews') {
      return;
    }

    let isMounted = true;

    async function loadVenueReviews() {
      setLoadingVenueReviews(true);
      setVenueReviewsError('');

      try {
        const reviewResponse = await fetchVenueReviews(selectedVenueId, {
          sort: venueReviewSort,
          limit: 30,
        });

        if (!isMounted) {
          return;
        }

        const normalizedReviewItems = (Array.isArray(reviewResponse?.items) ? reviewResponse.items : []).map((review) => ({
          id: review?.id,
          authorName: String(review?.author_name || review?.authorName || '').trim() || 'Anonymous',
          rating: Number(review?.rating || 0),
          title: String(review?.title || '').trim(),
          comment: String(review?.comment || review?.content || '').trim(),
          likeCount: Number(review?.like_count || review?.likeCount || 0),
          likedByMe: Boolean(review?.liked_by_me || review?.likedByMe),
          replyCount: Number(review?.reply_count || review?.replyCount || 0),
          createdAt: review?.created_at || review?.createdAt || null,
          imageUrls: resolveUniqueAssetUrls(
            normalizeImageUrlList(review?.image_urls || review?.imageUrls),
            apiBase
          ),
          replies: normalizeReviewReplies(review?.replies, apiBase),
        }));

        setVenueReviews(normalizedReviewItems);
        syncVenueRatingStats(
          selectedVenueId,
          Number(reviewResponse?.stats?.averageRating || 0),
          Number(reviewResponse?.stats?.totalReviews || normalizedReviewItems.length || 0)
        );
      } catch {
        if (!isMounted) {
          return;
        }

  setVenueReviews([]);
        setVenueReviewsError('Could not load reviews for this venue right now.');
      } finally {
        if (isMounted) {
          setLoadingVenueReviews(false);
        }
      }
    }

    loadVenueReviews();

    return () => {
      isMounted = false;
    };
  }, [apiBase, selectedVenueId, detailTab, venueReviewSort, venueReviewsRefreshKey]);

  useEffect(() => {
    if (!selectedVenueDetail || Number(selectedVenueDetail.id) !== Number(selectedVenueId)) {
      return;
    }

    const latitude = Number(selectedVenueDetail.latitude);
    const longitude = Number(selectedVenueDetail.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setMapCenter([latitude, longitude]);
  }, [selectedVenueDetail, selectedVenueId]);

  useEffect(() => {
    if (!selectedVenueId || detailTab !== 'photos') {
      return;
    }

    let isMounted = true;

    async function loadVenuePhotoData() {
      setLoadingVenueReviewImages(true);
      setVenueReviewImagesError('');

      try {
        const communityBundle = await fetchVenueCommunityBundle(selectedVenueId);

        if (!isMounted) {
          return;
        }

        const venueImagesFromBundle = resolveUniqueAssetUrls(normalizeImageUrlList(
          communityBundle?.photos?.venue || communityBundle?.venueImages || communityBundle?.venue?.venue_images
        ), apiBase);

        const venueImageSet = new Set(venueImagesFromBundle);
        const imagesFromBundle = resolveUniqueAssetUrls(normalizeImageUrlList(
          communityBundle?.photos?.reviews || communityBundle?.reviewImages
        ), apiBase)
          .filter((imageUrl) => !venueImageSet.has(imageUrl));

        setVenueReviewImages(
          imagesFromBundle
        );

        if (communityBundle?.venue && Number(communityBundle.venue.id) === Number(selectedVenueId)) {
          setSelectedVenueDetail((current) => ({
            ...(current || {}),
            ...communityBundle.venue,
            ...(venueImagesFromBundle.length ? { venue_images: venueImagesFromBundle } : {}),
          }));
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setVenueReviewImages([]);
        setVenueReviewImagesError('Could not load review photos for this venue right now.');
      } finally {
        if (isMounted) {
          setLoadingVenueReviewImages(false);
        }
      }
    }

    loadVenuePhotoData();

    return () => {
      isMounted = false;
    };
  }, [apiBase, selectedVenueId, detailTab]);

  return (
    <div className="city-map-fullscreen-page">
      <div className="city-map-fullscreen-canvas">
        <MapContainer center={safeMapCenter} zoom={mapZoom} preferCanvas style={{ height: '100%', width: '100%' }}>
          <MapViewportController center={safeMapCenter} zoom={mapZoom} />

          {useFallbackBaseTiles ? (
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                eventHandlers={{
                  tileerror: () => setUseFallbackBaseTiles(true),
                }}
              />

              <Pane name="city-map-road-labels" style={{ zIndex: 460, pointerEvents: 'none' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                  eventHandlers={{
                    tileerror: () => setUseFallbackBaseTiles(true),
                  }}
                />
              </Pane>
            </>
          )}

          {wards.map((ward) => {
            const isActive = selectedWardSet.has(String(ward.ward_id));
            const polygonBoundary = toPolygonBoundaryFeatureCollection(ward.boundary);

            if (!polygonBoundary) {
              return null;
            }

            return (
              <GeoJSON
                key={ward.ward_id}
                data={polygonBoundary}
                style={{
                  className: isActive ? 'city-map-ward-active' : 'city-map-ward-default',
                  color: isActive ? '#0f766e' : '#2f6e79',
                  weight: isActive ? 3 : 1.8,
                  fillColor: isActive ? '#6ad3bf' : '#91c5cc',
                  fillOpacity: isActive ? 0.2 : 0.08,
                }}
              >
                <Tooltip sticky direction="center" className="city-map-boundary-tooltip">
                  <span className="city-map-ward-label">{ward.name}</span>
                </Tooltip>
              </GeoJSON>
            );
          })}

          {displayedVenues.map((venue) => {
            const categoryId = resolveVenueCategoryId(venue);
            const markerIcon = buildCategoryIcon(categoryId || venue.id, categoryById.get(categoryId)?.icon);
            const markerLatitude = Number(venue.latitude);
            const markerLongitude = Number(venue.longitude);
            const popupRatingValue = normalizeHalfStarRating(resolveVenueRating(venue));
            const popupReviewCount = Number(
              venue?.total_reviews || venue?.totalReviews || venue?.review_count || venue?.reviewCount || 0
            );

            if (!Number.isFinite(markerLatitude) || !Number.isFinite(markerLongitude)) {
              return null;
            }

            return (
              <Marker
                key={`city-map-venue-${venue.id}`}
                position={[markerLatitude, markerLongitude]}
                icon={markerIcon}
                ref={(markerInstance) => {
                  const markerId = String(venue.id);
                  if (markerInstance) {
                    venueMarkerRefs.current.set(markerId, markerInstance);
                  } else {
                    venueMarkerRefs.current.delete(markerId);
                  }
                }}
                eventHandlers={{
                  click: () => openVenueDetailPanel(venue),
                }}
              >
                <Popup>
                  <div className="city-map-popup">
                    <img
                      src={resolveVenuePopupImage(venue, apiBase)}
                      alt={resolveVenueName(venue)}
                      className="city-map-popup-image"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_VENUE_IMAGE;
                      }}
                    />
                    <strong>{resolveVenueName(venue)}</strong>
                    <span>{venue.address || 'Address not available'}</span>
                    <span>{resolveWardName(venue)} | {resolveVenueCategoryName(venue)}</span>
                    <span className="city-map-popup-rating">
                      <StarRatingDisplay rating={popupRatingValue} />
                      <span className="city-map-popup-rating-text">
                        {popupRatingValue.toFixed(1)}/5 ({popupReviewCount} đánh giá)
                      </span>
                    </span>
                    {venue.phone ? <span>Phone: {venue.phone}</span> : null}
                    <button type="button" onClick={() => openVenueDetailPanel(venue)}>
                      Open full details
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {currentPosition ? (
            <Marker position={currentPosition} icon={userLocationIcon}>
              <Popup>
                <div className="city-map-popup">
                  <strong>Your current location</strong>
                </div>
              </Popup>
            </Marker>
          ) : null}

        </MapContainer>

        <header className="city-map-top-bar">
          <button type="button" className="city-map-back-btn" onClick={() => navigate(APP_ROUTES.HOME)}>
            {t.mapPage?.backToHome || 'Về trang chủ'}
          </button>
          <h1>{t.mapPage?.title || 'Bản đồ thành phố'}</h1>
          <p>{t.mapPage?.subtitle || 'Khám phá phường và địa điểm đã duyệt với bộ lọc thời gian thực.'}</p>
        </header>

        <div className="city-map-controls-left">
          <button
            type="button"
            className="city-map-control-btn"
            onClick={() => setIsFilterPanelOpen((current) => !current)}
          >
            Filters {activeFilterCount ? `(${activeFilterCount})` : ''}
          </button>
          <button
            type="button"
            className="city-map-control-btn"
            onClick={() => requestCurrentPosition(true)}
            disabled={locatingUser}
          >
            {locatingUser ? 'Locating...' : 'Locate Me'}
          </button>
        </div>

        {isFilterPanelOpen ? (
          <section className="city-map-filter-panel" role="region" aria-label="Map filters">
            <header>
              <h2>Map filters</h2>
              <button type="button" onClick={() => setIsFilterPanelOpen(false)} aria-label="Close filters">
                X
              </button>
            </header>
            <p>Choose Place Categories, Ward Naming, and Services Offered, then press Search.</p>

            <label className="city-map-search-field">
              <span>Search keyword</span>
              <input
                type="text"
                value={searchInput}
                placeholder="Venue, address, ward, or service"
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyFilters();
                  }
                }}
              />
            </label>

            <div className="city-map-filter-row">
              <div className="city-map-filter-group">
                <h3>Place Categories</h3>
                <div className="city-map-filter-list">
                  {categories.map((category) => {
                    const categoryId = Number(category.id);
                    const checked = selectedCategoryIds.includes(categoryId);

                    return (
                      <label key={`category-${categoryId}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(setSelectedCategoryIds)(categoryId)}
                        />
                        <span>{category.icon || '📍'} {category.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="city-map-filter-group">
                <h3>Ward Naming</h3>
                <div className="city-map-filter-list">
                  {wards.map((ward) => {
                    const wardId = String(ward.ward_id);
                    const checked = selectedWardIds.includes(wardId);

                    return (
                      <label key={`ward-${wardId}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(setSelectedWardIds)(wardId)}
                        />
                        <span>{ward.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="city-map-filter-group">
                <h3>Services Offered - Merchant</h3>
                <div className="city-map-filter-list">
                  {services.map((service) => {
                    const serviceId = Number(service.id);
                    const checked = selectedServiceIds.includes(serviceId);

                    return (
                      <label key={`service-${serviceId}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(setSelectedServiceIds)(serviceId)}
                        />
                        <span>{service.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="city-map-filter-actions">
              <button type="button" className="apply" onClick={applyFilters}>Search</button>
              <button type="button" className="clear" onClick={clearFilters}>Clear</button>
            </div>
          </section>
        ) : null}

        <div className="city-map-floating-stats">
          <span>{wards.length} wards</span>
          <span>{displayedVenues.length} places</span>
          <span>{currentPosition ? 'Current location on map' : 'Location unavailable'}</span>
        </div>

        {selectedVenue ? (
          <aside className="city-map-detail-sheet">
            <header className="city-map-detail-head">
              <div>
                <h2>{resolveVenueName(selectedVenue)}</h2>
                <p className="city-map-detail-rating-summary">
                  <button
                    type="button"
                    className="city-map-rating-link-btn"
                    onClick={() => setDetailTab('reviews')}
                    title="Bấm để mở tab Reviews"
                  >
                    <StarRatingDisplay rating={selectedVenueRatingValue} />
                  </button>
                  <span className="city-map-detail-rating-text">
                    {Number(selectedVenueRatingValue || 0).toFixed(1)}/5
                    {' '}
                    ({Number(selectedVenueReviewCount || 0)} đánh giá)
                  </span>
                </p>
              </div>
              <button type="button" onClick={closeDetailPanel} aria-label="Close venue detail">
                X
              </button>
            </header>

            {selectedVenueImages.length ? (
              <div className="city-map-detail-hero">
                <img
                  src={selectedVenueImages[0]}
                  alt={resolveVenueName(selectedVenue)}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_VENUE_IMAGE;
                  }}
                />
              </div>
            ) : (
              <div className="city-map-detail-hero is-empty">No cover image</div>
            )}

            <div className="city-map-detail-tabs" role="tablist" aria-label="Venue detail tabs">
              <button
                type="button"
                className={detailTab === 'overview' ? 'is-active' : ''}
                onClick={() => setDetailTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={detailTab === 'photos' ? 'is-active' : ''}
                onClick={() => setDetailTab('photos')}
              >
                Photos
              </button>
              <button
                type="button"
                className={detailTab === 'introduction' ? 'is-active' : ''}
                onClick={() => setDetailTab('introduction')}
              >
                Introduction
              </button>
              <button
                type="button"
                className={detailTab === 'reviews' ? 'is-active' : ''}
                onClick={() => setDetailTab('reviews')}
              >
                Reviews
              </button>
            </div>

            {loadingVenueDetail ? <p className="city-map-detail-note">Loading full venue details...</p> : null}
            {venueDetailError ? <p className="city-map-detail-note is-warning">{venueDetailError}</p> : null}

            {detailTab === 'overview' ? (
              <div className="city-map-detail-block">
                <ul className="city-map-detail-meta">
                  <li>
                    <strong>Address</strong>
                    {selectedVenue.address ? (
                      <button
                        type="button"
                        className="city-map-address-link"
                        onClick={focusOnVenueLocation}
                        title="Bấm để nhảy tới vị trí quán trên bản đồ"
                      >
                        {selectedVenue.address}
                      </button>
                    ) : (
                      <span>Not provided</span>
                    )}
                  </li>
                  <li><strong>Ward</strong><span>{resolveWardName(selectedVenue)}</span></li>
                  <li><strong>Category</strong><span>{resolveVenueCategoryName(selectedVenue)}</span></li>
                  <li><strong>Phone</strong><span>{selectedVenue.phone || 'Not provided'}</span></li>
                  <li><strong>Email</strong><span>{extractVenueEmail(selectedVenue)}</span></li>
                  <li><strong>Price range</strong><span>{formatPriceRange(selectedVenue)}</span></li>
                </ul>

                <div className="city-map-inline-group">
                  <strong>Quick summary</strong>
                  <p>Open the Introduction tab for services and opening hours.</p>
                </div>
              </div>
            ) : null}

            {detailTab === 'photos' ? (
              <div className="city-map-detail-block">
                <div className="city-map-photo-section">
                  <strong className="city-map-photo-section-title">Hình ảnh từ quán</strong>
                  {selectedVenueImages.length ? (
                    <div className="city-map-photo-grid">
                      {selectedVenueImages.map((imageUrl, index) => (
                        <button
                          key={`${imageUrl}-${index}`}
                          type="button"
                          className="city-map-photo-button"
                          onClick={() => openPhotoPreview(imageUrl, `${resolveVenueName(selectedVenue)} ${index + 1}`)}
                          aria-label={`Open venue photo ${index + 1}`}
                        >
                          <img
                            src={imageUrl}
                            alt={`${resolveVenueName(selectedVenue)} ${index + 1}`}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = FALLBACK_VENUE_IMAGE;
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="city-map-detail-note">Quán chưa đăng hình ảnh.</p>
                  )}
                </div>

                <div className="city-map-photo-section">
                  <strong className="city-map-photo-section-title">Hình ảnh từ đánh giá</strong>
                  {loadingVenueReviewImages ? <p className="city-map-detail-note">Đang tải ảnh đánh giá...</p> : null}
                  {venueReviewImagesError ? <p className="city-map-detail-note is-warning">{venueReviewImagesError}</p> : null}
                  {!loadingVenueReviewImages && !venueReviewImagesError ? (
                    venueReviewImages.length ? (
                      <div className="city-map-photo-grid">
                        {venueReviewImages.map((imageUrl, index) => (
                          <button
                            key={`review-${imageUrl}-${index}`}
                            type="button"
                            className="city-map-photo-button"
                            onClick={() => openPhotoPreview(imageUrl, `${resolveVenueName(selectedVenue)} review ${index + 1}`)}
                            aria-label={`Open review photo ${index + 1}`}
                          >
                            <img src={imageUrl} alt={`${resolveVenueName(selectedVenue)} review ${index + 1}`} loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="city-map-detail-note">Chưa có hình ảnh từ đánh giá.</p>
                    )
                  ) : null}
                </div>
              </div>
            ) : null}

            {detailTab === 'introduction' ? (
              <div className="city-map-detail-block">
                <strong>Introduction</strong>
                <p>{selectedVenue.description || 'No introduction provided yet.'}</p>

                <div className="city-map-inline-group">
                  <strong>Services offered</strong>
                  {selectedVenueServices.length ? (
                    <div className="city-map-service-list">
                      {selectedVenueServices.map((serviceName) => (
                        <span key={serviceName}>{serviceName}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="city-map-detail-note">No services selected by merchant.</p>
                  )}
                </div>

                <div className="city-map-inline-group">
                  <strong>Opening hours</strong>
                  {selectedVenueSchedule.length ? (
                    <ul className="city-map-hours-list">
                      {selectedVenueSchedule.map((day) => (
                        <li key={day.key}>
                          <span>{day.label}</span>
                          <span>{day.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="city-map-detail-note">Opening hours not provided.</p>
                  )}
                </div>
              </div>
            ) : null}

            {detailTab === 'reviews' ? (
              <div className="city-map-detail-block">
                <div className="city-map-review-summary-row">
                  <strong>
                    <button
                      type="button"
                      className="city-map-rating-link-btn"
                      onClick={() => {
                        setVenueReviewForm((prev) => ({
                          ...prev,
                          rating: normalizeHalfStarRating(selectedVenueRatingValue || prev.rating),
                        }));
                      }}
                      title="Bấm để dùng điểm sao hiện tại"
                    >
                      <StarRatingDisplay rating={selectedVenueRatingValue} />
                    </button>
                    {' '}
                    {Number(selectedVenueRatingValue || 0).toFixed(1)}/5 ({Number(selectedVenueReviewCount || 0)} đánh giá)
                  </strong>
                  <button
                    type="button"
                    className="city-map-review-report-btn"
                    onClick={openVenueReportModal}
                  >
                    ⚠ Báo lỗi
                  </button>
                </div>

                <form className="city-map-review-form" onSubmit={handleSubmitVenueReview}>
                  <label className="city-map-review-form-rating">
                    Đánh giá sao
                    <div className="city-map-star-picker" role="radiogroup" aria-label="Đánh giá sao">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const normalizedRating = normalizeHalfStarRating(venueReviewForm.rating);
                        const isFull = normalizedRating >= value;
                        const isHalf = !isFull && normalizedRating >= value - 0.5;

                        return (
                          <button
                            key={`city-map-review-rating-${value}`}
                            type="button"
                            className={`city-map-star-picker-btn ${isFull ? 'is-active' : ''} ${isHalf ? 'is-half' : ''}`}
                            onClick={(event) => setVenueReviewForm((prev) => ({
                              ...prev,
                              rating: resolveHalfStarSelection(event, value),
                            }))}
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>
                  </label>

                  <input
                    type="text"
                    placeholder="Tiêu đề"
                    value={venueReviewForm.title}
                    onChange={(event) => setVenueReviewForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <textarea
                    rows="3"
                    placeholder="Viết bình luận của bạn..."
                    value={venueReviewForm.comment}
                    onChange={(event) => setVenueReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                  />

                  <label className="city-map-review-media-upload">
                    📷/🎬 Ảnh & Video
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(event) => {
                        const pickedFiles = Array.from(event.target.files || []);
                        setVenueReviewForm((prev) => ({
                          ...prev,
                          mediaFiles: [...(Array.isArray(prev.mediaFiles) ? prev.mediaFiles : []), ...pickedFiles].slice(0, 6),
                        }));
                        event.target.value = '';
                      }}
                    />
                    <small>
                      {(Array.isArray(venueReviewForm.mediaFiles) && venueReviewForm.mediaFiles.length)
                        ? `Đã chọn ${venueReviewForm.mediaFiles.length}/6 tệp`
                        : 'Tối đa 6 tệp'}
                    </small>
                  </label>

                  {reviewMediaPreviews.length ? (
                    <div className="city-map-photo-grid">
                      {reviewMediaPreviews.map((item) => (
                        <div key={`review-media-preview-${item.id}`} className="city-map-photo-button">
                          {item.isVideo ? (
                            <video src={item.url} controls preload="metadata" />
                          ) : (
                            <img src={item.url} alt="Review media preview" loading="lazy" />
                          )}
                          <button
                            type="button"
                            className="city-map-review-action-btn"
                            onClick={() => {
                              setVenueReviewForm((prev) => ({
                                ...prev,
                                mediaFiles: (Array.isArray(prev.mediaFiles) ? prev.mediaFiles : []).filter(
                                  (file) => `${file.name}-${file.lastModified}-${file.size}` !== item.id
                                ),
                              }));
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {reviewFormError ? <p className="city-map-review-error">{reviewFormError}</p> : null}

                  <button type="submit" disabled={submittingVenueReview}>
                    {submittingVenueReview ? 'Đang gửi...' : 'Đăng bình luận'}
                  </button>
                </form>

                <div className="city-map-review-toolbar">
                  <label htmlFor="cityMapReviewSort">Sort reviews</label>
                  <select
                    id="cityMapReviewSort"
                    value={venueReviewSort}
                    onChange={(event) => setVenueReviewSort(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="rating_high">Rating: high to low</option>
                    <option value="rating_low">Rating: low to high</option>
                  </select>
                </div>

                {loadingVenueReviews ? <p className="city-map-detail-note">Loading reviews...</p> : null}
                {venueReviewsError ? <p className="city-map-detail-note is-warning">{venueReviewsError}</p> : null}
                {reviewActionError ? <p className="city-map-detail-note is-warning">{reviewActionError}</p> : null}

                {!loadingVenueReviews && !venueReviewsError ? (
                  venueReviews.length ? (
                    <div className="city-map-review-list">
                      {venueReviews.map((review) => (
                        <article key={review.id} className="city-map-review-item">
                          <header>
                            <strong>{review.authorName || 'Anonymous'}</strong>
                            <span>{Number(review.rating || 0).toFixed(1)} / 5</span>
                          </header>
                          {review.title ? <strong className="city-map-review-title">{review.title}</strong> : null}
                          <p>{review.comment || 'No written comment provided.'}</p>

                          <div className="city-map-review-action-row">
                            <button
                              type="button"
                              className={`city-map-review-action-btn ${review.likedByMe ? 'is-active' : ''}`}
                              onClick={() => handleToggleMapReviewLike(review)}
                            >
                              ♥ Thích {Number(review.likeCount || 0)}
                            </button>
                            <button
                              type="button"
                              className="city-map-review-action-btn"
                              onClick={() => handleOpenReplyComposer(review)}
                            >
                              💬 Bình luận {Number(review.replyCount || (Array.isArray(review.replies) ? review.replies.length : 0))}
                            </button>
                            <button
                              type="button"
                              className="city-map-review-action-btn"
                              onClick={() => openReviewReportModal(review)}
                            >
                              ⚠ Báo lỗi
                            </button>
                          </div>

                          {Array.isArray(review.imageUrls) && review.imageUrls.length ? (
                            <div className="city-map-photo-grid">
                              {review.imageUrls.map((imageUrl, imageIndex) => (
                                <div key={`review-image-${review.id}-${imageIndex}`} className="city-map-photo-button">
                                  {isVideoAssetUrl(imageUrl) ? (
                                    <video src={imageUrl} controls preload="metadata" />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openPhotoPreview(imageUrl, `${resolveVenueName(selectedVenue)} review ${imageIndex + 1}`)}
                                      aria-label={`Open review photo ${imageIndex + 1}`}
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`${resolveVenueName(selectedVenue)} review ${imageIndex + 1}`}
                                        loading="lazy"
                                        onError={(event) => {
                                          event.currentTarget.onerror = null;
                                          event.currentTarget.src = FALLBACK_VENUE_IMAGE;
                                        }}
                                      />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <small>{formatReviewDateTime(review.createdAt)}</small>

                          {Array.isArray(review.replies) && review.replies.length ? (
                            <div className="city-map-review-replies">
                              {review.replies.map((reply) => (
                                <article key={`review-reply-${review.id}-${reply.id}`} className="city-map-review-reply-item">
                                  <header>
                                    <strong>{reply.authorName || 'Anonymous'}</strong>
                                    {Number(reply.rating || 0) > 0 ? <span>{Number(reply.rating || 0).toFixed(1)} / 5</span> : null}
                                  </header>
                                  {reply.title ? <strong className="city-map-review-title">{reply.title}</strong> : null}
                                  <p>{reply.content || 'No written comment provided.'}</p>

                                  <div className="city-map-review-action-row">
                                    <button
                                      type="button"
                                      className={`city-map-review-action-btn ${reply.likedByMe ? 'is-active' : ''}`}
                                      onClick={() => handleToggleMapReplyLike(review, reply)}
                                    >
                                      ♥ Thích {Number(reply.likeCount || 0)}
                                    </button>
                                    <button
                                      type="button"
                                      className="city-map-review-action-btn"
                                      onClick={() => handleOpenReplyComposer(review, reply)}
                                    >
                                      💬 Bình luận
                                    </button>
                                  </div>

                                  {Array.isArray(reply.imageUrls) && reply.imageUrls.length ? (
                                    <div className="city-map-photo-grid">
                                      {reply.imageUrls.map((imageUrl, imageIndex) => (
                                        <div key={`reply-image-${reply.id}-${imageIndex}`} className="city-map-photo-button">
                                          {isVideoAssetUrl(imageUrl) ? (
                                            <video src={imageUrl} controls preload="metadata" />
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => openPhotoPreview(imageUrl, `${resolveVenueName(selectedVenue)} reply ${imageIndex + 1}`)}
                                              aria-label={`Open reply photo ${imageIndex + 1}`}
                                            >
                                              <img
                                                src={imageUrl}
                                                alt={`${resolveVenueName(selectedVenue)} reply ${imageIndex + 1}`}
                                                loading="lazy"
                                                onError={(event) => {
                                                  event.currentTarget.onerror = null;
                                                  event.currentTarget.src = FALLBACK_VENUE_IMAGE;
                                                }}
                                              />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  <small>{formatReviewDateTime(reply.createdAt)}</small>
                                </article>
                              ))}
                            </div>
                          ) : null}

                          {activeReplyReviewId === review.id ? (
                            <div className="city-map-review-reply-form">
                              <label className="city-map-review-form-rating">
                                Đánh giá sao
                                <div className="city-map-star-picker" role="radiogroup" aria-label="Đánh giá sao cho thảo luận">
                                  {[1, 2, 3, 4, 5].map((value) => {
                                    const normalizedRating = normalizeHalfStarRating(venueReplyForm.rating);
                                    const isFull = normalizedRating >= value;
                                    const isHalf = !isFull && normalizedRating >= value - 0.5;

                                    return (
                                      <button
                                        key={`city-map-reply-rating-${review.id}-${value}`}
                                        type="button"
                                        className={`city-map-star-picker-btn ${isFull ? 'is-active' : ''} ${isHalf ? 'is-half' : ''}`}
                                        onClick={(event) => setVenueReplyForm((prev) => ({
                                          ...prev,
                                          rating: resolveHalfStarSelection(event, value),
                                        }))}
                                      >
                                        ★
                                      </button>
                                    );
                                  })}
                                </div>
                              </label>

                              <input
                                type="text"
                                placeholder="Tiêu đề"
                                value={venueReplyForm.title}
                                onChange={(event) => setVenueReplyForm((prev) => ({ ...prev, title: event.target.value }))}
                              />
                              <textarea
                                rows="2"
                                placeholder="Viết thảo luận..."
                                value={venueReplyForm.content}
                                onChange={(event) => setVenueReplyForm((prev) => ({ ...prev, content: event.target.value }))}
                              />

                              <div className="city-map-review-reply-form-actions">
                                <button
                                  type="button"
                                  className="city-map-review-action-btn"
                                  onClick={() => {
                                    setActiveReplyReviewId(null);
                                    setVenueReplyForm({ rating: null, title: '', content: '' });
                                  }}
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  className="city-map-review-action-btn is-primary"
                                  disabled={submittingVenueReply}
                                  onClick={() => handleSubmitVenueReply(review)}
                                >
                                  {submittingVenueReply ? 'Đang gửi...' : 'Gửi thảo luận'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="city-map-detail-note">No reviews available for this venue.</p>
                  )
                ) : null}
              </div>
            ) : null}
          </aside>
        ) : (
          <aside className="city-map-detail-placeholder">
            <h2>Venue details</h2>
            <p>Click any place on the map to open a full detail panel on the right.</p>
          </aside>
        )}

        {(loadingBaseData || loadingVenues) && !error ? (
          <div className="city-map-overlay">Loading map data...</div>
        ) : null}
        {!loadingBaseData && !loadingVenues && error ? (
          <div className="city-map-overlay is-error">{error}</div>
        ) : null}

        {photoPreviewUrl ? (
          <div
            className="city-map-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={photoPreviewAlt || 'Venue photo preview'}
            onClick={closePhotoPreview}
          >
            <button type="button" className="city-map-image-lightbox-close" onClick={closePhotoPreview}>
              X
            </button>
            <img
              src={photoPreviewUrl}
              alt={photoPreviewAlt || 'Venue photo'}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}

        {showVenueReportModal ? (
          <div className="city-map-report-modal-overlay" onClick={() => setShowVenueReportModal(false)}>
            <div
              className="city-map-report-modal-card"
              role="dialog"
              aria-modal="true"
              aria-label="Báo cáo địa điểm"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="city-map-report-modal-head">
                <h3>⚠ Báo cáo địa điểm</h3>
                <button type="button" onClick={() => setShowVenueReportModal(false)} aria-label="Đóng">×</button>
              </header>

              <form className="city-map-report-modal-form" onSubmit={handleSubmitVenueReport}>
                <label>
                  Lý do báo cáo
                  <select
                    value={venueReportForm.reason}
                    onChange={(event) =>
                      setVenueReportForm((prev) => ({ ...prev, reason: event.target.value }))
                    }
                    required
                  >
                    <option value="">— Chọn lý do —</option>
                    {VENUE_REPORT_REASON_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Mô tả chi tiết
                  <textarea
                    rows="4"
                    placeholder="Mô tả chi tiết vấn đề bạn gặp..."
                    value={venueReportForm.description}
                    onChange={(event) =>
                      setVenueReportForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </label>

                <div className="city-map-report-upload-row">
                  <label className="city-map-report-upload-btn">
                    📷 Tải ảnh lên
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setVenueReportForm((prev) => ({ ...prev, attachment: file }));
                      }}
                    />
                  </label>

                  {venueReportAttachmentPreview ? (
                    <div className="city-map-report-upload-preview">
                      <img src={venueReportAttachmentPreview} alt="Ảnh minh họa báo cáo" />
                      <button
                        type="button"
                        onClick={() => setVenueReportForm((prev) => ({ ...prev, attachment: null }))}
                        aria-label="Xóa ảnh minh họa"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="city-map-report-severity-row">
                  <span>Hoặc chọn nhanh:</span>
                  <div>
                    {REPORT_SEVERITY_OPTIONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`city-map-report-severity-chip ${venueReportForm.severity === item.value ? 'is-active' : ''}`}
                        onClick={() => setVenueReportForm((prev) => ({ ...prev, severity: item.value }))}
                      >
                        {item.stars} {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="city-map-report-warning">⚠️ Báo cáo sai có thể bị hạn chế tài khoản</p>

                {venueReportStatus.message ? (
                  <p className={`city-map-report-status ${venueReportStatus.type}`}>{venueReportStatus.message}</p>
                ) : null}

                <div className="city-map-report-actions">
                  <button type="button" onClick={() => setShowVenueReportModal(false)}>Hủy</button>
                  <button type="submit" className="is-danger" disabled={submittingVenueReport}>
                    {submittingVenueReport ? 'Đang gửi...' : 'Gửi báo cáo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showReviewReportModal && activeReviewToReport ? (
          <div className="city-map-report-modal-overlay" onClick={() => setShowReviewReportModal(false)}>
            <div
              className="city-map-report-modal-card city-map-comment-report-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Báo lỗi bình luận"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="city-map-report-modal-head">
                <h3>⚠ Báo lỗi bình luận</h3>
                <button type="button" onClick={() => setShowReviewReportModal(false)} aria-label="Đóng">×</button>
              </header>

              <p className="city-map-report-intro">Vui lòng chọn lý do và mô tả chi tiết khi báo lỗi bình luận này.</p>

              <div className="city-map-comment-report-preview">
                <strong>{activeReviewToReport.authorName || 'Ẩn danh'}</strong>
                <p>{activeReviewToReport.comment || 'Không có nội dung bình luận.'}</p>
              </div>

              <form className="city-map-report-modal-form" onSubmit={handleSubmitReviewReport}>
                <fieldset className="city-map-report-radio-grid">
                  <legend>Lý do báo lỗi:</legend>
                  {REVIEW_REPORT_REASON_OPTIONS.map((item) => (
                    <label key={item.value}>
                      <input
                        type="radio"
                        name="review-report-reason"
                        value={item.value}
                        checked={reviewReportForm.reason === item.value}
                        onChange={(event) =>
                          setReviewReportForm((prev) => ({ ...prev, reason: event.target.value }))
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </fieldset>

                <input
                  type="text"
                  placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                  value={reviewReportForm.description}
                  onChange={(event) =>
                    setReviewReportForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />

                <div className="city-map-report-upload-row">
                  <label className="city-map-report-upload-btn">
                    📷 Tải ảnh lên
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setReviewReportForm((prev) => ({ ...prev, attachment: file }));
                      }}
                    />
                  </label>

                  {reviewReportAttachmentPreview ? (
                    <div className="city-map-report-upload-preview">
                      <img src={reviewReportAttachmentPreview} alt="Ảnh minh họa báo lỗi bình luận" />
                      <button
                        type="button"
                        onClick={() => setReviewReportForm((prev) => ({ ...prev, attachment: null }))}
                        aria-label="Xóa ảnh báo lỗi bình luận"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>

                <p className="city-map-report-warning">⚠️ Việc gửi báo cáo sai sự thật có thể dẫn đến hạn chế tài khoản</p>

                {reviewReportStatus.message ? (
                  <p className={`city-map-report-status ${reviewReportStatus.type}`}>{reviewReportStatus.message}</p>
                ) : null}

                <div className="city-map-report-actions">
                  <button type="button" onClick={() => setShowReviewReportModal(false)}>Hủy</button>
                  <button type="submit" className="is-danger" disabled={submittingReviewReport}>
                    {submittingReviewReport ? 'Đang gửi...' : 'Gửi báo lỗi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CityMapPage;

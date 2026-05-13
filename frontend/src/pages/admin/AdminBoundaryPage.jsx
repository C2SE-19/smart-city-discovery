import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SectionCard from '../../components/common/SectionCard';
import useAdminI18n from '../../hooks/useAdminI18n';
import {
  createAdminVenueReview,
  createAdminVenueReviewReply,
  deleteAdminVenueReview,
  deleteAdminVenueReviewReply,
  createAdminMerchantService,
  createAdminPlaceCategory,
  deleteAdminMerchantService,
  deleteAdminPlaceCategory,
  deleteAdminWard,
  fetchAdminMerchantServices,
  fetchAdminVenueReviews,
  fetchAdminVenueUpdateRequests,
  fetchAdminVenueDetail,
  fetchAdminPlaceCategories,
  fetchAdminVenues,
  fetchAdminWards,
  moderateAdminVenue,
  moderateAdminVenueUpdateRequest,
  updateAdminMerchantService,
  updateAdminPlaceCategory,
  upsertAdminWard,
} from '../../services/api/adminMapApi';
import {
  buildPlaceCategoryTree,
  formatCategoryBranchLabel,
  normalizeCategoryIcon
} from '../../utils/placeCategoryTree';
import { getApiOrigin } from '../../services/api/client';
import './AdminBoundaryPage.css';

const DEFAULT_CENTER = [16.0471, 108.2068];
const DEFAULT_ZOOM = 12;
const EMPTY_BOUNDARY_TEMPLATE = '{\n  "type": "FeatureCollection",\n  "features": []\n}';

const PAGE_MODES = [
  {
    value: 'pending',
    label: 'Pending Posts',
    helper: 'Review merchant submissions and approve/reject each post.',
  },
  {
    value: 'ward',
    label: 'Ward Naming',
    helper: 'Click a ward boundary to update or delete it. Use Add Ward to create a new boundary.',
  },
  {
    value: 'category',
    label: 'Place Categories',
    helper: 'Manage a single shared category list used by merchant and user screens.',
  },
  {
    value: 'service',
    label: 'Services Offered - Merchant',
    helper: 'Manage service options shown in merchant registration and moderation details.',
  },
];

const CATEGORY_PIN_COLORS = ['#0f766e', '#ea580c', '#2563eb', '#db2777', '#7c3aed', '#65a30d', '#dc2626', '#0891b2'];
const categoryIconCache = new Map();
const PLACE_CATEGORY_ICON_OPTIONS = [
  '🍽️', '☕', '🍜', '🥐', '🍸', '🍰', '🛍️', '🎯', '🏞️', '📍',
  '🍔', '🍕', '🍣', '🍖', '🥗', '🍦', '🧋', '🍺', '🍷', '🥘',
  '🏨', '🛏️', '🏬', '🛒', '🏪', '💊', '🏥', '🩺', '🏫', '📚',
  '🏛️', '🏦', '💼', '🏢', '🧰', '🔧', '🚗', '⛽', '🧼', '💇',
  '💄', '💅', '🧖', '💪', '⚽', '🎬', '🎵', '🎨', '🖼️', '📸',
  '🪴', '🌳', '🏖️', '🗺️', '🚉', '🚌', '✈️', '🚴', '🐶', '🐱'
];
const DEFAULT_PLACE_CATEGORY_ICON = '📍';
const VENUE_WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const approvedIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-approved',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pendingIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-pending',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const rejectedIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-rejected',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const updateRequestNewIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-update-new',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const updateRequestOldIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-update-old',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function slugifyText(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeComparableText(value) {
  return String(value || '').trim();
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

function normalizeExactSearchText(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizeVietnameseToneInsensitive(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '')
    .toLowerCase()
    .trim();
}

function buildVenueNameSearchSource(venue) {
  const venueTitle = String(venue?.title || '').trim();
  const venueName = String(venue?.name || '').trim();

  if (venueTitle && venueName && venueTitle.toLowerCase() !== venueName.toLowerCase()) {
    return `${venueTitle} ${venueName}`.trim();
  }

  return venueTitle || venueName;
}

function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalizeJsonValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function areJsonValuesEqual(firstValue, secondValue) {
  return JSON.stringify(canonicalizeJsonValue(firstValue)) === JSON.stringify(canonicalizeJsonValue(secondValue));
}

function extractBoundaryFeatures(boundary) {
  if (!boundary || typeof boundary !== 'object') {
    return [];
  }

  if (boundary.type === 'FeatureCollection' && Array.isArray(boundary.features)) {
    return boundary.features;
  }

  if (boundary.type === 'Feature') {
    return [boundary];
  }

  return [];
}

function toPolygonBoundaryFeatureCollection(boundary) {
  const polygonFeatures = extractBoundaryFeatures(boundary).filter((feature) => {
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

function normalizeCoordinateValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }

  return Number(value.toFixed(6));
}

function normalizeGeometryCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    return normalizeCoordinateValue(coordinates);
  }

  return coordinates.map((item) => normalizeGeometryCoordinates(item));
}

function buildBoundaryGeometrySignature(boundary) {
  const features = extractBoundaryFeatures(boundary);

  const geometrySignatures = features
    .map((feature) => feature?.geometry)
    .filter((geometry) => geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type))
    .map((geometry) =>
      JSON.stringify(
        canonicalizeJsonValue({
          type: geometry.type,
          coordinates: normalizeGeometryCoordinates(geometry.coordinates),
        })
      )
    )
    .sort();

  if (!geometrySignatures.length) {
    return '';
  }

  return JSON.stringify(geometrySignatures);
}

function haveSameBoundaryGeometry(firstBoundary, secondBoundary) {
  const firstSignature = buildBoundaryGeometrySignature(firstBoundary);
  const secondSignature = buildBoundaryGeometrySignature(secondBoundary);

  return Boolean(firstSignature) && firstSignature === secondSignature;
}

function isSameWardData(ward, draftWard) {
  if (!ward) {
    return false;
  }

  return (
    normalizeComparableText(ward.name) === normalizeComparableText(draftWard.name) &&
    normalizeComparableText(ward.description) === normalizeComparableText(draftWard.description) &&
    areJsonValuesEqual(ward.boundary, draftWard.boundary)
  );
}

function statusLabel(status, tx) {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'approved') {
    return tx('Approved');
  }

  if (normalizedStatus === 'rejected') {
    return tx('Rejected');
  }

  return tx('Pending');
}

function formatDateTime(dateValue, locale, tx) {
  if (!dateValue) {
    return tx('Not available');
  }

  return new Date(dateValue).toLocaleString(locale);
}

function isPriorityApprovalVenue(venue) {
  return Boolean(
    venue?.moderationPriority?.isPriorityApproval
    || venue?.assignedAdPackage?.features?.priorityReview
  );
}

function resolvePriorityQueuedAt(venue) {
  const value = venue?.moderationPriority?.queuedAt || venue?.submitted_at || venue?.created_at || '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function resolveLocationUpdateQueuedAt(request) {
  const value = request?.submitted_at || request?.created_at || '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function resolveStandardQueuedAt(venue) {
  const value = venue?.submitted_at || venue?.created_at || '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeVenueUpdateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      name: '',
      title: '',
      address: '',
      description: '',
      phone: '',
      latitude: null,
      longitude: null,
      wardId: '',
      categoryId: null,
      coverImageUrl: '',
      businessLicenseImageUrl: '',
      metadata: {},
    };
  }

  const latitude = Number(snapshot.latitude);
  const longitude = Number(snapshot.longitude);

  return {
    name: String(snapshot.name || '').trim(),
    title: String(snapshot.title || '').trim(),
    address: String(snapshot.address || '').trim(),
    description: String(snapshot.description || '').trim(),
    phone: String(snapshot.phone || '').trim(),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    wardId: String(snapshot.wardId || snapshot.ward_id || '').trim(),
    categoryId: Number.isFinite(Number(snapshot.categoryId ?? snapshot.category_id))
      ? Number(snapshot.categoryId ?? snapshot.category_id)
      : null,
    coverImageUrl: String(snapshot.coverImageUrl || snapshot.cover_image_url || '').trim(),
    businessLicenseImageUrl: String(snapshot.businessLicenseImageUrl || snapshot.business_license_image_url || '').trim(),
    metadata: normalizeVenueMetadata(snapshot.metadata),
  };
}

function resolveStatusIcon(status) {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'approved') {
    return approvedIcon;
  }

  if (normalizedStatus === 'rejected') {
    return rejectedIcon;
  }

  return pendingIcon;
}

function hashKey(value) {
  const text = String(value ?? '0');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function resolveCategoryColor(categoryId) {
  const index = hashKey(categoryId) % CATEGORY_PIN_COLORS.length;
  return CATEGORY_PIN_COLORS[index];
}

function resolveCategoryIcon(categoryId, iconSymbol) {
  const color = resolveCategoryColor(categoryId);
  const normalizedIcon = normalizeCategoryIcon(iconSymbol);
  const cacheKey = `${color}-${normalizedIcon}`;

  if (!categoryIconCache.has(cacheKey)) {
    categoryIconCache.set(
      cacheKey,
      L.divIcon({
        className: 'admin-venue-pin admin-venue-pin-category-icon',
        html: `<span style="background:${color}"><b>${normalizedIcon}</b></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
    );
  }

  return categoryIconCache.get(cacheKey);
}

function extractBoundaryCenter(boundary) {
  const features = extractBoundaryFeatures(boundary);

  for (const feature of features) {
    const geometry = feature?.geometry;

    if (!geometry) {
      continue;
    }

    if (geometry.type === 'Polygon') {
      const firstPoint = geometry.coordinates?.[0]?.[0];
      if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
        return [Number(firstPoint[1]), Number(firstPoint[0])];
      }
    }

    if (geometry.type === 'MultiPolygon') {
      const firstPoint = geometry.coordinates?.[0]?.[0]?.[0];
      if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
        return [Number(firstPoint[1]), Number(firstPoint[0])];
      }
    }
  }

  return null;
}

function sortCategories(categories) {
  return [...categories].sort((first, second) => String(first.name || '').localeCompare(String(second.name || '')));
}

function sortMerchantServices(services) {
  return [...services].sort((first, second) => {
    const firstOrder = Number(first.sort_order ?? first.sortOrder ?? 0);
    const secondOrder = Number(second.sort_order ?? second.sortOrder ?? 0);

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return String(first.name || '').localeCompare(String(second.name || ''));
  });
}

function formatVenueCategoryLabel(venue, placeCategoryTree, fallbackLabel = 'Uncategorized') {
  const categoryId = Number(venue?.category_id ?? venue?.categoryId);
  const fallbackCategoryName = String(venue?.category_name || venue?.categoryName || '').trim();

  if (Number.isInteger(categoryId) && categoryId > 0) {
    return formatCategoryBranchLabel(categoryId, placeCategoryTree, fallbackCategoryName || fallbackLabel);
  }

  return fallbackCategoryName || fallbackLabel;
}

function formatVenueUpdateCategoryLabel(snapshot, placeCategoryTree, fallbackLabel = 'Not provided') {
  const categoryId = Number(snapshot?.categoryId ?? snapshot?.category_id);

  if (Number.isInteger(categoryId) && categoryId > 0) {
    return formatCategoryBranchLabel(categoryId, placeCategoryTree, fallbackLabel);
  }

  return fallbackLabel;
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

function normalizeSelectedServiceIds(selectedServices) {
  if (!Array.isArray(selectedServices)) {
    return [];
  }

  return [...new Set(selectedServices.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function extractVenueServiceIds(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  return normalizeSelectedServiceIds(metadata.selectedServices);
}

function resolveVenueServiceNames(venue, serviceNameMap) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const serviceIds = normalizeSelectedServiceIds(metadata.selectedServices);
  const mappedNames = serviceIds.map((serviceId) => serviceNameMap.get(serviceId)).filter(Boolean);

  if (mappedNames.length) {
    return [...new Set(mappedNames)];
  }

  if (!Array.isArray(metadata.selectedServiceNames)) {
    return [];
  }

  return [...new Set(metadata.selectedServiceNames.map((name) => String(name || '').trim()).filter(Boolean))];
}

function normalizeImageUrls(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function resolveAssetUrl(rawUrl) {
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

function extractVenueGalleryImages(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const galleryImages = normalizeImageUrls(metadata.galleryImages);
  const fallbackImages = normalizeImageUrls(metadata.images || metadata.imageUrls || metadata.photos);
  const coverImage = typeof venue?.cover_image_url === 'string' ? venue.cover_image_url.trim() : '';

  const merged = [...galleryImages, ...fallbackImages];

  if (coverImage) {
    merged.unshift(coverImage);
  }

  return [...new Set(merged)];
}

function extractUpdateSnapshotGalleryImages(snapshot) {
  const metadata = normalizeVenueMetadata(snapshot?.metadata);
  const galleryImages = normalizeImageUrls(metadata.galleryImages);
  const fallbackImages = normalizeImageUrls(metadata.images || metadata.imageUrls || metadata.photos);
  const coverImage = typeof snapshot?.coverImageUrl === 'string' ? snapshot.coverImageUrl.trim() : '';

  const merged = [...galleryImages, ...fallbackImages];

  if (coverImage) {
    merged.unshift(coverImage);
  }

  return [...new Set(merged)];
}

function formatMetadataOperatingHours(metadata, tx = (value) => value) {
  const normalizedMetadata = normalizeVenueMetadata(metadata);
  const weeklySource =
    normalizedMetadata.weeklyOpenHours && typeof normalizedMetadata.weeklyOpenHours === 'object' && !Array.isArray(normalizedMetadata.weeklyOpenHours)
      ? normalizedMetadata.weeklyOpenHours
      : normalizedMetadata.weeklySchedule && typeof normalizedMetadata.weeklySchedule === 'object' && !Array.isArray(normalizedMetadata.weeklySchedule)
        ? normalizedMetadata.weeklySchedule
        : null;

  if (weeklySource) {
    for (const day of VENUE_WEEK_DAYS) {
      const dayValue = weeklySource?.[day.key];

      if (!dayValue || typeof dayValue !== 'object') {
        continue;
      }

      const isClosed = Boolean(dayValue.isClosed ?? dayValue.closed ?? dayValue.is_off ?? dayValue.off);
      if (isClosed) {
        continue;
      }

      const openTime = String(dayValue.openTime ?? dayValue.open ?? dayValue.start ?? dayValue.startTime ?? '').trim();
      const closeTime = String(dayValue.closeTime ?? dayValue.close ?? dayValue.end ?? dayValue.endTime ?? '').trim();

      if (openTime && closeTime) {
        return `${openTime} - ${closeTime}`;
      }
    }
  }

  const startTime = String(normalizedMetadata.startTime || '').trim();
  const endTime = String(normalizedMetadata.endTime || '').trim();

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`;
  }

  return tx('Not provided');
}

function extractMetadataWeeklySchedule(metadata, tx = (value) => value) {
  const normalizedMetadata = normalizeVenueMetadata(metadata);
  const fallbackStart = String(normalizedMetadata.startTime || '').trim();
  const fallbackEnd = String(normalizedMetadata.endTime || '').trim();
  const hasFallbackRange = Boolean(fallbackStart && fallbackEnd);
  const weeklySchedule =
    normalizedMetadata.weeklyOpenHours && typeof normalizedMetadata.weeklyOpenHours === 'object' && !Array.isArray(normalizedMetadata.weeklyOpenHours)
        ? normalizedMetadata.weeklyOpenHours
      : normalizedMetadata.weeklySchedule && typeof normalizedMetadata.weeklySchedule === 'object' && !Array.isArray(normalizedMetadata.weeklySchedule)
        ? normalizedMetadata.weeklySchedule
        : null;

  if (!weeklySchedule) {
    return [];
  }

  return VENUE_WEEK_DAYS.map((day) => {
    const rawDay = weeklySchedule?.[day.key];

    if (!rawDay || typeof rawDay !== 'object') {
      if (hasFallbackRange) {
        return `${tx(day.label)}: ${fallbackStart} - ${fallbackEnd}`;
      }

      return `${tx(day.label)}: ${tx('Not provided')}`;
    }

    const isClosed = Boolean(rawDay.isClosed ?? rawDay.closed ?? rawDay.is_off ?? rawDay.off);
    if (isClosed) {
      return `${tx(day.label)}: ${tx('Closed')}`;
    }

    const openTime = String(rawDay.openTime ?? rawDay.open ?? rawDay.start ?? rawDay.startTime ?? '').trim();
    const closeTime = String(rawDay.closeTime ?? rawDay.close ?? rawDay.end ?? rawDay.endTime ?? '').trim();

    if (openTime && closeTime) {
      return `${tx(day.label)}: ${openTime} - ${closeTime}`;
    }

    if (hasFallbackRange) {
      return `${tx(day.label)}: ${fallbackStart} - ${fallbackEnd}`;
    }

    return `${tx(day.label)}: ${tx('Not provided')}`;
  });
}

function formatCurrencyVnd(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 'Not provided';
  }

  return `${amount.toLocaleString('vi-VN')} VND`;
}

function formatCoordinate(value) {
  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return 'Not provided';
  }

  return coordinate.toFixed(6);
}

function normalizeUpdateComparableValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(6));
  }

  if (value === undefined) {
    return null;
  }

  return value;
}

function hasUpdateFieldChanged(oldValue, newValue) {
  return !areJsonValuesEqual(
    normalizeUpdateComparableValue(oldValue),
    normalizeUpdateComparableValue(newValue)
  );
}

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) {
      return;
    }

    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchAdminVenuesWithRetry(maxAttempts = 3) {
  let lastError = null;
  const venueParams = { status: 'pending,approved' };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchAdminVenues(venueParams);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        await wait(350 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchAdminWardsWithRetry(maxAttempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchAdminWards();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        await wait(350 * attempt);
      }
    }
  }

  throw lastError;
}

function AdminBoundaryPage() {
  const { language, locale, tx, formatNumber } = useAdminI18n();
  const [activeMode, setActiveMode] = useState('pending');
  const [pendingQueueView, setPendingQueueView] = useState('submissions');
  const [wards, setWards] = useState([]);
  const [venues, setVenues] = useState([]);
  const [venueUpdateRequests, setVenueUpdateRequests] = useState([]);
  const [placeCategories, setPlaceCategories] = useState([]);
  const [merchantServices, setMerchantServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [operationMessage, setOperationMessage] = useState('');

  const [submittingWard, setSubmittingWard] = useState(false);
  const [deletingWard, setDeletingWard] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [submittingService, setSubmittingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState(null);
  const [moderatingVenueId, setModeratingVenueId] = useState(null);
  const [moderatingUpdateRequestId, setModeratingUpdateRequestId] = useState(null);

  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedUpdateRequestId, setSelectedUpdateRequestId] = useState(null);
  const [selectedUpdateLocationView, setSelectedUpdateLocationView] = useState('new');
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [updateRejectReasons, setUpdateRejectReasons] = useState({});
  const [isSubmissionDetailClosed, setIsSubmissionDetailClosed] = useState(false);
  const [selectedVenueImageIndex, setSelectedVenueImageIndex] = useState(0);
  const [expandedImageUrl, setExpandedImageUrl] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [selectedVenueReviewSort, setSelectedVenueReviewSort] = useState('newest');
  const [selectedVenueReviews, setSelectedVenueReviews] = useState([]);
  const [isLoadingSelectedVenueReviews, setIsLoadingSelectedVenueReviews] = useState(false);
  const [selectedVenueReviewsError, setSelectedVenueReviewsError] = useState('');
  const [selectedVenueDetail, setSelectedVenueDetail] = useState(null);
  const [adminVenueCommentDraft, setAdminVenueCommentDraft] = useState({ title: '', comment: '' });
  const [adminVenueCommentMediaFiles, setAdminVenueCommentMediaFiles] = useState([]);
  const [submittingAdminVenueComment, setSubmittingAdminVenueComment] = useState(false);
  const [adminReviewReplyDrafts, setAdminReviewReplyDrafts] = useState({});
  const [adminReviewReplyMediaDrafts, setAdminReviewReplyMediaDrafts] = useState({});
  const [activeAdminReplyTarget, setActiveAdminReplyTarget] = useState(null);
  const [sendingReviewReplyId, setSendingReviewReplyId] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [deletingReplyId, setDeletingReplyId] = useState(null);

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [isPendingFilterPanelOpen, setIsPendingFilterPanelOpen] = useState(false);
  const [pendingSearchInput, setPendingSearchInput] = useState('');
  const [selectedPendingCategoryIds, setSelectedPendingCategoryIds] = useState([]);
  const [expandedPendingCategoryRootIds, setExpandedPendingCategoryRootIds] = useState([]);
  const [selectedPendingWardIds, setSelectedPendingWardIds] = useState([]);
  const [selectedPendingServiceIds, setSelectedPendingServiceIds] = useState([]);
  const [appliedPendingSearch, setAppliedPendingSearch] = useState('');
  const [appliedPendingCategoryIds, setAppliedPendingCategoryIds] = useState([]);
  const [appliedPendingWardIds, setAppliedPendingWardIds] = useState([]);
  const [appliedPendingServiceIds, setAppliedPendingServiceIds] = useState([]);

  const [wardForm, setWardForm] = useState({
    name: '',
    description: '',
    boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
  });
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryIconInput, setCategoryIconInput] = useState('');
  const [subcategoryNameInput, setSubcategoryNameInput] = useState('');
  const [subcategoryIconInput, setSubcategoryIconInput] = useState('');
  const [serviceNameInput, setServiceNameInput] = useState('');

  const buildDefaultAdminReplyDraft = (authorName = '') => {
    const normalizedAuthorName = String(authorName || '').trim();

    return {
      title: '',
      content: normalizedAuthorName ? `@${normalizedAuthorName} ` : '',
    };
  };

  const pendingModeVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() !== 'rejected'),
    [venues]
  );
  const approvedVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() === 'approved'),
    [venues]
  );
  const serviceNameById = useMemo(
    () =>
      new Map(
        merchantServices
          .map((service) => [Number(service.id), String(service.name || '').trim()])
          .filter(([serviceId, serviceName]) => Number.isInteger(serviceId) && serviceId > 0 && Boolean(serviceName))
      ),
    [merchantServices]
  );
  const placeCategoryTree = useMemo(() => buildPlaceCategoryTree(placeCategories), [placeCategories]);
  const rootPlaceCategories = placeCategoryTree.rootCategories;
  const childCategoriesByParentId = placeCategoryTree.childrenByParentId;
  const placeCategoryById = useMemo(
    () =>
      new Map(
        placeCategoryTree.categories
          .map((category) => [Number(category.id), category])
          .filter(([categoryId]) => Number.isInteger(categoryId) && categoryId > 0)
      ),
    [placeCategoryTree.categories]
  );
  const usageEligibleVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() !== 'rejected'),
    [venues]
  );
  const categoryModeVenues = useMemo(
    () =>
      approvedVenues.filter((venue) => {
        if (!selectedCategoryId) {
          return true;
        }

        return Number(venue.category_id) === Number(selectedCategoryId);
      }),
    [approvedVenues, selectedCategoryId]
  );
  const serviceModeVenues = useMemo(
    () =>
      approvedVenues.filter((venue) => {
        if (!selectedServiceId) {
          return true;
        }

        const targetServiceId = Number(selectedServiceId);
        const matchedById = extractVenueServiceIds(venue).includes(targetServiceId);

        if (matchedById) {
          return true;
        }

        const targetServiceName = normalizeSearchText(serviceNameById.get(targetServiceId));
        if (!targetServiceName) {
          return false;
        }

        return resolveVenueServiceNames(venue, serviceNameById)
          .map((serviceName) => normalizeSearchText(serviceName))
          .includes(targetServiceName);
      }),
    [approvedVenues, selectedServiceId, serviceNameById]
  );
  const visibleVenues = useMemo(() => {
    if (activeMode === 'pending') {
      return pendingModeVenues;
    }

    if (activeMode === 'category') {
      return categoryModeVenues;
    }

    if (activeMode === 'service') {
      return serviceModeVenues;
    }

    return approvedVenues;
  }, [activeMode, pendingModeVenues, categoryModeVenues, serviceModeVenues, approvedVenues]);

  const normalizedAppliedPendingSearch = useMemo(
    () => normalizeSearchText(appliedPendingSearch),
    [appliedPendingSearch]
  );
  const exactAppliedPendingSearch = useMemo(
    () => normalizeExactSearchText(appliedPendingSearch),
    [appliedPendingSearch]
  );
  const toneInsensitiveAppliedPendingSearch = useMemo(
    () => normalizeVietnameseToneInsensitive(appliedPendingSearch),
    [appliedPendingSearch]
  );

  const pendingFilteredVenues = useMemo(() => {
    return pendingModeVenues.filter((venue) => {
      const categoryId = Number(venue.category_id);
      const wardId = String(venue.ward_id || '');
      const venueServiceIds = extractVenueServiceIds(venue);

      if (appliedPendingCategoryIds.length && !appliedPendingCategoryIds.includes(categoryId)) {
        return false;
      }

      if (appliedPendingWardIds.length && !appliedPendingWardIds.includes(wardId)) {
        return false;
      }

      if (
        appliedPendingServiceIds.length &&
        !appliedPendingServiceIds.some((serviceId) => {
          if (venueServiceIds.includes(serviceId)) {
            return true;
          }

          const targetServiceName = normalizeSearchText(serviceNameById.get(Number(serviceId)));
          if (!targetServiceName) {
            return false;
          }

          return resolveVenueServiceNames(venue, serviceNameById)
            .map((serviceName) => normalizeSearchText(serviceName))
            .includes(targetServiceName);
        })
      ) {
        return false;
      }

      if (!normalizedAppliedPendingSearch) {
        return true;
      }

      const venueNameSearchSource = buildVenueNameSearchSource(venue);
      if (!venueNameSearchSource) {
        return false;
      }

      const exactVenueName = normalizeExactSearchText(venueNameSearchSource);
      const toneInsensitiveVenueName = normalizeVietnameseToneInsensitive(venueNameSearchSource);
      const asciiVenueName = normalizeSearchText(venueNameSearchSource);

      const isNameMatched = (
        exactVenueName.includes(exactAppliedPendingSearch)
        || toneInsensitiveVenueName.includes(toneInsensitiveAppliedPendingSearch)
        || asciiVenueName.includes(normalizedAppliedPendingSearch)
      );

      return isNameMatched;
    });
  }, [
    pendingModeVenues,
    appliedPendingCategoryIds,
    appliedPendingWardIds,
    appliedPendingServiceIds,
    exactAppliedPendingSearch,
    toneInsensitiveAppliedPendingSearch,
    normalizedAppliedPendingSearch,
    placeCategoryTree,
    serviceNameById,
  ]);

  const pendingQueueVenues = useMemo(
    () =>
      pendingFilteredVenues
        .filter((venue) => String(venue.status || '').toLowerCase() === 'pending')
        .slice()
        .sort((firstVenue, secondVenue) => {
          const firstIsPriority = isPriorityApprovalVenue(firstVenue);
          const secondIsPriority = isPriorityApprovalVenue(secondVenue);

          if (firstIsPriority && !secondIsPriority) {
            return -1;
          }

          if (!firstIsPriority && secondIsPriority) {
            return 1;
          }

          if (firstIsPriority && secondIsPriority) {
            return resolvePriorityQueuedAt(firstVenue) - resolvePriorityQueuedAt(secondVenue);
          }

          return resolveStandardQueuedAt(secondVenue) - resolveStandardQueuedAt(firstVenue);
        }),
    [pendingFilteredVenues]
  );
  const pendingLocationUpdateRequests = useMemo(
    () =>
      venueUpdateRequests
        .filter((request) => String(request?.status || '').toLowerCase() === 'pending')
        .slice()
        .sort((firstRequest, secondRequest) => {
          const firstIsPriority = Boolean(firstRequest?.has_priority_approval);
          const secondIsPriority = Boolean(secondRequest?.has_priority_approval);

          if (firstIsPriority && !secondIsPriority) {
            return -1;
          }

          if (!firstIsPriority && secondIsPriority) {
            return 1;
          }

          if (firstIsPriority && secondIsPriority) {
            return resolveLocationUpdateQueuedAt(firstRequest) - resolveLocationUpdateQueuedAt(secondRequest);
          }

          return resolveLocationUpdateQueuedAt(secondRequest) - resolveLocationUpdateQueuedAt(firstRequest);
        }),
    [venueUpdateRequests]
  );

  const pendingActiveFilterCount =
    appliedPendingCategoryIds.length +
    appliedPendingWardIds.length +
    appliedPendingServiceIds.length +
    (appliedPendingSearch ? 1 : 0);

  const selectedVenueSummary = useMemo(
    () => pendingFilteredVenues.find((venue) => Number(venue.id) === Number(selectedVenueId)) || null,
    [pendingFilteredVenues, selectedVenueId]
  );
  const selectedVenue = useMemo(() => {
    if (!selectedVenueSummary) {
      return null;
    }

    if (Number(selectedVenueDetail?.id) === Number(selectedVenueSummary.id)) {
      return { ...selectedVenueDetail, ...selectedVenueSummary };
    }

    return selectedVenueSummary;
  }, [selectedVenueSummary, selectedVenueDetail]);
  const selectedUpdateRequest = useMemo(
    () =>
      pendingLocationUpdateRequests.find(
        (request) => Number(request.id) === Number(selectedUpdateRequestId)
      ) || null,
    [pendingLocationUpdateRequests, selectedUpdateRequestId]
  );
  const selectedUpdateOldSnapshot = useMemo(
    () => normalizeVenueUpdateSnapshot(selectedUpdateRequest?.old_snapshot),
    [selectedUpdateRequest]
  );
  const selectedUpdateProposedSnapshot = useMemo(
    () => normalizeVenueUpdateSnapshot(selectedUpdateRequest?.proposed_snapshot),
    [selectedUpdateRequest]
  );
  const selectedUpdateOldServiceNames = useMemo(
    () => resolveVenueServiceNames({ metadata: selectedUpdateOldSnapshot.metadata }, serviceNameById),
    [selectedUpdateOldSnapshot, serviceNameById]
  );
  const selectedUpdateNewServiceNames = useMemo(
    () => resolveVenueServiceNames({ metadata: selectedUpdateProposedSnapshot.metadata }, serviceNameById),
    [selectedUpdateProposedSnapshot, serviceNameById]
  );
  const selectedUpdateActiveSnapshot = useMemo(
    () => (selectedUpdateLocationView === 'old' ? selectedUpdateOldSnapshot : selectedUpdateProposedSnapshot),
    [selectedUpdateLocationView, selectedUpdateOldSnapshot, selectedUpdateProposedSnapshot]
  );
  const selectedUpdateActiveServiceNames = useMemo(
    () => (selectedUpdateLocationView === 'old' ? selectedUpdateOldServiceNames : selectedUpdateNewServiceNames),
    [selectedUpdateLocationView, selectedUpdateOldServiceNames, selectedUpdateNewServiceNames]
  );
  const selectedUpdateActiveGalleryImages = useMemo(
    () => extractUpdateSnapshotGalleryImages(selectedUpdateActiveSnapshot),
    [selectedUpdateActiveSnapshot]
  );
  const selectedUpdateActiveImage =
    selectedUpdateActiveGalleryImages[selectedVenueImageIndex] ||
    selectedUpdateActiveGalleryImages[0] ||
    selectedUpdateActiveSnapshot?.coverImageUrl ||
    '';
  const selectedUpdateActiveBusinessLicenseImage = String(selectedUpdateActiveSnapshot?.businessLicenseImageUrl || '').trim();
  const selectedUpdateActiveOperatingHours = useMemo(
    () => formatMetadataOperatingHours(selectedUpdateActiveSnapshot?.metadata, tx),
    [selectedUpdateActiveSnapshot, tx]
  );
  const selectedUpdateActiveWeeklySchedule = useMemo(
    () => extractMetadataWeeklySchedule(selectedUpdateActiveSnapshot?.metadata, tx),
    [selectedUpdateActiveSnapshot, tx]
  );
  const selectedWard = useMemo(
    () => wards.find((ward) => ward.ward_id === selectedWardId) || null,
    [wards, selectedWardId]
  );
  const selectedCategory = useMemo(
    () => placeCategoryTree.categoryById.get(Number(selectedCategoryId)) || null,
    [placeCategoryTree, selectedCategoryId]
  );
  const selectedSubcategory = useMemo(
    () => placeCategoryTree.categoryById.get(Number(selectedSubcategoryId)) || null,
    [placeCategoryTree, selectedSubcategoryId]
  );
  const selectedCategoryChildren = useMemo(
    () => childCategoriesByParentId.get(Number(selectedCategoryId)) || [],
    [childCategoriesByParentId, selectedCategoryId]
  );
  const selectedMerchantService = useMemo(
    () => merchantServices.find((service) => Number(service.id) === Number(selectedServiceId)) || null,
    [merchantServices, selectedServiceId]
  );
  const serviceUsageCountById = useMemo(() => {
    const countById = new Map();

    usageEligibleVenues.forEach((venue) => {
      const venueServiceIds = new Set(extractVenueServiceIds(venue));
      const venueServiceNames = new Set(
        resolveVenueServiceNames(venue, serviceNameById).map((serviceName) => normalizeSearchText(serviceName))
      );

      merchantServices.forEach((service) => {
        const serviceId = Number(service.id);
        const serviceName = normalizeSearchText(service.name);

        if (!Number.isInteger(serviceId) || serviceId <= 0) {
          return;
        }

        if (venueServiceIds.has(serviceId) || (serviceName && venueServiceNames.has(serviceName))) {
          countById.set(serviceId, (countById.get(serviceId) || 0) + 1);
        }
      });
    });

    return countById;
  }, [usageEligibleVenues, merchantServices, serviceNameById]);
  const categoryUsageCountById = useMemo(() => {
    const countById = new Map();

    usageEligibleVenues.forEach((venue) => {
      const categoryId = Number(venue.category_id);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return;
      }

      countById.set(categoryId, (countById.get(categoryId) || 0) + 1);
    });

    return countById;
  }, [usageEligibleVenues]);
  const selectedVenueMetadata = useMemo(() => normalizeVenueMetadata(selectedVenue?.metadata), [selectedVenue]);
  const selectedVenueServiceNames = useMemo(
    () => (selectedVenue ? resolveVenueServiceNames(selectedVenue, serviceNameById) : []),
    [selectedVenue, serviceNameById]
  );
  const selectedVenueGalleryImages = useMemo(
    () => (selectedVenue ? extractVenueGalleryImages(selectedVenue) : []),
    [selectedVenue]
  );
  const selectedVenueActiveImage =
    selectedVenueGalleryImages[selectedVenueImageIndex] || selectedVenueGalleryImages[0] || selectedVenue?.cover_image_url || '';
  const selectedVenueOperatingHours = useMemo(
    () => formatMetadataOperatingHours(selectedVenueMetadata, tx),
    [selectedVenueMetadata, tx]
  );
  const selectedVenueWeeklySchedule = useMemo(
    () => extractMetadataWeeklySchedule(selectedVenueMetadata, tx),
    [selectedVenueMetadata, tx]
  );
  const selectedVenueIntroduction = useMemo(() => {
    return String(
      selectedVenue?.description ||
      selectedVenueMetadata.introduction ||
      selectedVenueMetadata.intro ||
      selectedVenueMetadata.story ||
      ''
    ).trim();
  }, [selectedVenue, selectedVenueMetadata]);
  const selectedVenueRatingSummary = useMemo(() => {
    const directRating = Number(selectedVenue?.average_rating ?? selectedVenue?.averageRating);
    const directTotal = Number(
      selectedVenue?.total_reviews ??
      selectedVenue?.totalReviews ??
      selectedVenue?.review_count ??
      selectedVenue?.reviewCount
    );

    const ratedReviews = selectedVenueReviews
      .map((review) => Number(review?.rating))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const fallbackTotal = ratedReviews.length;
    const fallbackAverage = fallbackTotal
      ? ratedReviews.reduce((sum, rating) => sum + rating, 0) / fallbackTotal
      : 0;

    return {
      average: Number.isFinite(directRating) && directRating > 0 ? directRating : fallbackAverage,
      total: Number.isFinite(directTotal) && directTotal >= 0 ? directTotal : fallbackTotal,
    };
  }, [selectedVenue, selectedVenueReviews]);
  const activeDetailGalleryImages = useMemo(() => {
    if (activeMode === 'pending' && pendingQueueView === 'updates') {
      return selectedUpdateActiveGalleryImages;
    }

    return selectedVenueGalleryImages;
  }, [activeMode, pendingQueueView, selectedUpdateActiveGalleryImages, selectedVenueGalleryImages]);
  const activeModeMeta = PAGE_MODES.find((mode) => mode.value === activeMode);

  async function loadData() {
    setLoading(true);
    setError('');
    setLoadWarning('');

    try {
      const [wardResult, venueResult, updateRequestResult] = await Promise.allSettled([
        fetchAdminWardsWithRetry(),
        fetchAdminVenuesWithRetry(),
        fetchAdminVenueUpdateRequests({ status: 'pending' }),
      ]);

      const [categoryResult, serviceResult] = await Promise.allSettled([
        fetchAdminPlaceCategories(),
        fetchAdminMerchantServices(),
      ]);

      const failedCoreMessages = [];
      const optionalFailures = [];

      if (wardResult.status === 'fulfilled') {
        setWards(Array.isArray(wardResult.value) ? wardResult.value : []);
      } else {
        setWards([]);
        failedCoreMessages.push(wardResult.reason?.response?.data?.message || 'Could not load ward boundaries');
      }

      if (venueResult.status === 'fulfilled') {
        setVenues(Array.isArray(venueResult.value) ? venueResult.value : []);
      } else {
        // Keep previously loaded venues if a transient request fails during startup.
      }

      if (updateRequestResult.status === 'fulfilled') {
        setVenueUpdateRequests(Array.isArray(updateRequestResult.value) ? updateRequestResult.value : []);
      } else {
        setVenueUpdateRequests([]);
      }

      if (categoryResult.status === 'fulfilled') {
        const categories = Array.isArray(categoryResult.value) ? categoryResult.value : [];
        setPlaceCategories(sortCategories(categories));
      } else {
        setPlaceCategories([]);
        optionalFailures.push('place categories');
      }

      if (serviceResult.status === 'fulfilled') {
        const services = Array.isArray(serviceResult.value) ? serviceResult.value : [];
        setMerchantServices(sortMerchantServices(services));
      } else {
        setMerchantServices([]);
        optionalFailures.push('merchant services');
      }

      if (failedCoreMessages.length) {
        setError(failedCoreMessages[0] || 'Could not load map management data.');
      } else if (optionalFailures.length) {
        setLoadWarning(`Loaded map data with limited modules: ${optionalFailures.join(', ')}.`);
      }
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Could not load map management data.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshWardsAndVenues() {
    const [wardData, venueData] = await Promise.all([fetchAdminWardsWithRetry(), fetchAdminVenuesWithRetry()]);
    setWards(wardData);
    setVenues(venueData);
  }

  async function refreshPendingModerationData() {
    const [venueData, updateRequestData] = await Promise.all([
      fetchAdminVenuesWithRetry(),
      fetchAdminVenueUpdateRequests({ status: 'pending' }),
    ]);
    setVenues(Array.isArray(venueData) ? venueData : []);
    setVenueUpdateRequests(Array.isArray(updateRequestData) ? updateRequestData : []);
  }

  async function refreshCategoriesAndVenues() {
    const [categoryData, venueData] = await Promise.all([fetchAdminPlaceCategories(), fetchAdminVenuesWithRetry()]);
    setPlaceCategories(sortCategories(categoryData));
    setVenues(venueData);
  }

  async function refreshMerchantServices() {
    const serviceData = await fetchAdminMerchantServices();
    setMerchantServices(sortMerchantServices(serviceData));
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    if (pendingQueueView === 'updates') {
      if (!pendingLocationUpdateRequests.length) {
        setSelectedUpdateRequestId(null);
        setIsSubmissionDetailClosed(false);
        return;
      }

      const hasSelectedRequest = selectedUpdateRequestId
        ? pendingLocationUpdateRequests.some((request) => Number(request.id) === Number(selectedUpdateRequestId))
        : false;

      if (!hasSelectedRequest) {
        setSelectedUpdateRequestId(null);
      }

      if (isSubmissionDetailClosed) {
        return;
      }

      if (!hasSelectedRequest) {
        setSelectedUpdateRequestId(pendingLocationUpdateRequests[0]?.id ?? null);
      }

      return;
    }

    if (!pendingFilteredVenues.length) {
      setSelectedVenueId(null);
      setIsSubmissionDetailClosed(false);
      return;
    }

    const hasSelectedVenue = selectedVenueId
      ? pendingFilteredVenues.some((venue) => Number(venue.id) === Number(selectedVenueId))
      : false;

    if (!hasSelectedVenue) {
      setSelectedVenueId(null);
    }

    if (isSubmissionDetailClosed) {
      return;
    }

    if (!hasSelectedVenue) {
      const fallbackVenueId = pendingQueueVenues[0]?.id ?? pendingFilteredVenues[0]?.id ?? null;
      setSelectedVenueId(fallbackVenueId);
    }
  }, [
    activeMode,
    pendingQueueView,
    pendingFilteredVenues,
    pendingQueueVenues,
    pendingLocationUpdateRequests,
    selectedVenueId,
    selectedUpdateRequestId,
    isSubmissionDetailClosed,
  ]);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    const focusSource = pendingQueueView === 'updates'
      ? selectedUpdateActiveSnapshot
      : selectedVenue;

    const rawLatitude = focusSource?.latitude;
    const rawLongitude = focusSource?.longitude;
    if (rawLatitude === null || rawLatitude === undefined || rawLongitude === null || rawLongitude === undefined) {
      return;
    }

    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(15);
    }
  }, [activeMode, pendingQueueView, selectedVenue, selectedUpdateActiveSnapshot]);

  useEffect(() => {
    setSelectedVenueImageIndex(0);
    setExpandedImageUrl('');
  }, [activeMode, pendingQueueView, selectedVenueId, selectedUpdateRequestId, selectedUpdateLocationView]);

  useEffect(() => {
    setActiveDetailTab('overview');
    setSelectedVenueReviewSort('newest');
    setSelectedVenueReviews([]);
    setSelectedVenueReviewsError('');
    setSelectedVenueDetail(null);
    setAdminVenueCommentDraft({ title: '', comment: '' });
    setAdminVenueCommentMediaFiles([]);
    setSubmittingAdminVenueComment(false);
    setAdminReviewReplyDrafts({});
    setAdminReviewReplyMediaDrafts({});
    setActiveAdminReplyTarget(null);
    setSendingReviewReplyId(null);
    setDeletingReviewId(null);
    setDeletingReplyId(null);
  }, [activeMode, pendingQueueView, selectedVenueId, selectedUpdateRequestId]);

  useEffect(() => {
    if (activeMode !== 'pending' || pendingQueueView !== 'submissions' || !selectedVenueId) {
      return;
    }

    let isMounted = true;

    async function loadSelectedVenueDetail() {
      try {
        const detail = await fetchAdminVenueDetail(selectedVenueId);

        if (!isMounted) {
          return;
        }

        setSelectedVenueDetail(detail || null);
      } catch {
        if (isMounted) {
          setSelectedVenueDetail(null);
        }
      }
    }

    loadSelectedVenueDetail();

    return () => {
      isMounted = false;
    };
  }, [activeMode, pendingQueueView, selectedVenueId]);

  useEffect(() => {
    if (activeMode !== 'pending' || pendingQueueView !== 'submissions' || !selectedVenue?.id) {
      return;
    }

    let isMounted = true;

    async function loadVenueReviews() {
      setIsLoadingSelectedVenueReviews(true);
      setSelectedVenueReviewsError('');

      try {
        const response = await fetchAdminVenueReviews(selectedVenue.id, {
          sort: selectedVenueReviewSort,
        });

        if (!isMounted) {
          return;
        }

        setSelectedVenueReviews(Array.isArray(response?.items) ? response.items : []);
      } catch (reviewError) {
        if (!isMounted) {
          return;
        }

        setSelectedVenueReviews([]);
        setSelectedVenueReviewsError(reviewError.response?.data?.message || 'Could not load venue reviews.');
      } finally {
        if (isMounted) {
          setIsLoadingSelectedVenueReviews(false);
        }
      }
    }

    loadVenueReviews();

    return () => {
      isMounted = false;
    };
  }, [activeMode, pendingQueueView, selectedVenue?.id, selectedVenueReviewSort]);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    let pollingInFlight = false;
    let isMounted = true;

    const refreshPendingData = async () => {
      if (pollingInFlight) {
        return;
      }

      pollingInFlight = true;

      try {
        const [freshVenues, freshUpdateRequests] = await Promise.all([
          fetchAdminVenuesWithRetry(2),
          fetchAdminVenueUpdateRequests({ status: 'pending' }),
        ]);

        if (!isMounted) {
          return;
        }

        setVenues(Array.isArray(freshVenues) ? freshVenues : []);
        setVenueUpdateRequests(Array.isArray(freshUpdateRequests) ? freshUpdateRequests : []);
        setError((currentError) => (/venue/i.test(String(currentError || '')) ? '' : currentError));
        setLoadWarning((currentWarning) => (/venue/i.test(String(currentWarning || '')) ? '' : currentWarning));
      } catch {
        // Polling failures should be silent to avoid disrupting moderation workflow.
      } finally {
        pollingInFlight = false;
      }
    };

    refreshPendingData();

    const intervalId = window.setInterval(refreshPendingData, 5000);
    const handleWindowFocus = () => {
      refreshPendingData();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeMode]);

  useEffect(() => {
    if (!selectedWardId) {
      return;
    }

    if (!wards.some((ward) => ward.ward_id === selectedWardId)) {
      setSelectedWardId('');
      setWardForm({
        name: '',
        description: '',
        boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
      });
    }
  }, [selectedWardId, wards]);

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const foundCategory = placeCategories.find((category) => Number(category.id) === Number(selectedCategoryId));
    if (!foundCategory) {
      setSelectedCategoryId(null);
      setCategoryNameInput('');
      setCategoryIconInput('');
      setSelectedSubcategoryId(null);
      setSubcategoryNameInput('');
      setSubcategoryIconInput('');
    }
  }, [placeCategories, selectedCategoryId]);

  useEffect(() => {
    if (!selectedSubcategoryId) {
      return;
    }

    const foundSubcategory = placeCategories.find((category) => Number(category.id) === Number(selectedSubcategoryId));
    if (!foundSubcategory) {
      setSelectedSubcategoryId(null);
      setSubcategoryNameInput('');
      setSubcategoryIconInput('');
    }
  }, [placeCategories, selectedSubcategoryId]);

  useEffect(() => {
    if (!selectedServiceId) {
      return;
    }

    const foundService = merchantServices.find((service) => Number(service.id) === Number(selectedServiceId));
    if (!foundService) {
      setSelectedServiceId(null);
      setServiceNameInput('');
    }
  }, [merchantServices, selectedServiceId]);

  useEffect(() => {
    if (activeMode !== 'category') {
      return;
    }

    if (!selectedCategoryId || !categoryModeVenues.length) {
      return;
    }

    const firstVenue = categoryModeVenues[0];
    const latitude = Number(firstVenue.latitude);
    const longitude = Number(firstVenue.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(13);
    }
  }, [activeMode, selectedCategoryId, categoryModeVenues]);

  useEffect(() => {
    if (activeMode !== 'service') {
      return;
    }

    if (!selectedServiceId && merchantServices.length) {
      const firstService = merchantServices[0];
      setSelectedServiceId(firstService.id);
      setServiceNameInput(firstService.name || '');
      return;
    }

    if (!selectedServiceId || !serviceModeVenues.length) {
      return;
    }

    const firstVenue = serviceModeVenues[0];
    const latitude = Number(firstVenue.latitude);
    const longitude = Number(firstVenue.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(13);
    }
  }, [activeMode, selectedServiceId, serviceModeVenues, merchantServices]);

  function handleModeChange(mode) {
    setActiveMode(mode);
    setError('');
    setOperationMessage('');
    setIsSubmissionDetailClosed(false);
    setIsPendingFilterPanelOpen(false);

    if (mode === 'pending') {
      if (pendingQueueView === 'updates') {
        setSelectedUpdateLocationView('new');
        setSelectedUpdateRequestId(pendingLocationUpdateRequests[0]?.id ?? null);
      } else {
        const fallbackVenueId = pendingQueueVenues[0]?.id ?? pendingFilteredVenues[0]?.id ?? null;
        setSelectedVenueId(fallbackVenueId);
      }
    }

    if (mode === 'service' && !selectedServiceId && merchantServices.length) {
      const firstService = merchantServices[0];
      setSelectedServiceId(firstService.id);
      setServiceNameInput(firstService.name || '');
    }
  }

  function handlePendingQueueViewChange(nextQueueView) {
    setPendingQueueView(nextQueueView);
    setIsSubmissionDetailClosed(false);
    setIsPendingFilterPanelOpen(false);

    if (nextQueueView === 'updates') {
      setSelectedUpdateLocationView('new');
      setSelectedUpdateRequestId(pendingLocationUpdateRequests[0]?.id ?? null);
      return;
    }

    const fallbackVenueId = pendingQueueVenues[0]?.id ?? pendingFilteredVenues[0]?.id ?? null;
    setSelectedVenueId(fallbackVenueId);
  }

  const togglePendingSelection = (setter) => (value) => {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const togglePendingCategoryBranchExpansion = (categoryId) => {
    setExpandedPendingCategoryRootIds((currentIds) =>
      currentIds.includes(categoryId)
        ? currentIds.filter((currentId) => currentId !== categoryId)
        : [...currentIds, categoryId]
    );
  };

  const togglePendingCategoryBranchSelection = (categoryId) => {
    setExpandedPendingCategoryRootIds((currentIds) => (
      currentIds.includes(categoryId)
        ? currentIds
        : [...currentIds, categoryId]
    ));

    setSelectedPendingCategoryIds((currentIds) => {
      return currentIds.includes(categoryId)
        ? currentIds.filter((currentId) => currentId !== categoryId)
        : [...currentIds, categoryId];
    });
  };

  function applyPendingFilters() {
    const nextAppliedSearch = pendingSearchInput.trim();
    const normalizedNextSearch = normalizeSearchText(nextAppliedSearch);

    setAppliedPendingSearch(nextAppliedSearch);
    setAppliedPendingCategoryIds(selectedPendingCategoryIds);
    setAppliedPendingWardIds(selectedPendingWardIds);
    setAppliedPendingServiceIds(selectedPendingServiceIds);
    setIsPendingFilterPanelOpen(false);

    if (selectedPendingWardIds.length) {
      const selectedWards = wards.filter((ward) => selectedPendingWardIds.includes(String(ward.ward_id)));
      const selectedCenters = selectedWards.map((ward) => extractBoundaryCenter(ward.boundary)).filter(Boolean);

      if (selectedCenters.length) {
        const sum = selectedCenters.reduce(
          (result, center) => ({ lat: result.lat + center[0], lng: result.lng + center[1] }),
          { lat: 0, lng: 0 }
        );
        setMapCenter([sum.lat / selectedCenters.length, sum.lng / selectedCenters.length]);
        setMapZoom(selectedCenters.length === 1 ? 14 : 13);
        return;
      }
    }

    const nextFilteredVenues = pendingModeVenues.filter((venue) => {
      const categoryId = Number(venue.category_id);
      const wardId = String(venue.ward_id || '');
      const venueServiceIds = extractVenueServiceIds(venue);

      if (selectedPendingCategoryIds.length && !selectedPendingCategoryIds.includes(categoryId)) {
        return false;
      }

      if (selectedPendingWardIds.length && !selectedPendingWardIds.includes(wardId)) {
        return false;
      }

      if (
        selectedPendingServiceIds.length &&
        !selectedPendingServiceIds.some((serviceId) => {
          if (venueServiceIds.includes(serviceId)) {
            return true;
          }

          const targetServiceName = normalizeSearchText(serviceNameById.get(Number(serviceId)));
          if (!targetServiceName) {
            return false;
          }

          return resolveVenueServiceNames(venue, serviceNameById)
            .map((serviceName) => normalizeSearchText(serviceName))
            .includes(targetServiceName);
        })
      ) {
        return false;
      }

      if (!normalizedNextSearch) {
        return true;
      }

      const venueSearchSource = [
        venue.title,
        venue.name,
        venue.address,
        venue.ward_name,
        venue.ward_id,
        venue.category_name,
        venue.description,
        venue.phone,
        ...resolveVenueServiceNames(venue, serviceNameById),
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeSearchText(venueSearchSource).includes(normalizedNextSearch);
    });

    const firstFilterMatch = nextFilteredVenues[0];
    if (firstFilterMatch) {
      const latitude = Number(firstFilterMatch.latitude);
      const longitude = Number(firstFilterMatch.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
      }
    }
  }

  function clearPendingFilters() {
    setPendingSearchInput('');
    setSelectedPendingCategoryIds([]);
    setSelectedPendingWardIds([]);
    setSelectedPendingServiceIds([]);
    setAppliedPendingSearch('');
    setAppliedPendingCategoryIds([]);
    setAppliedPendingWardIds([]);
    setAppliedPendingServiceIds([]);
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
  }

  function loadWardToEditor(ward) {
    setSelectedWardId(ward.ward_id);
    setWardForm({
      name: ward.name || '',
      description: ward.description || '',
      boundaryJson: JSON.stringify(ward.boundary, null, 2),
    });

    const center = extractBoundaryCenter(ward.boundary);
    if (center) {
      setMapCenter(center);
      setMapZoom(14);
    }
  }

  function prepareAddWard() {
    setSelectedWardId('');
    setWardForm({
      name: '',
      description: '',
      boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
    });
  }

  function handleWardInputChange(event) {
    const { name, value } = event.target;
    setWardForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleBoundaryFileLoad(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setWardForm((currentForm) => ({
        ...currentForm,
        boundaryJson: String(reader.result || ''),
      }));
    };
    reader.readAsText(file);
  }

  async function handleSaveWard(mode) {
    setError('');
    setOperationMessage('');

    const name = wardForm.name.trim();
    if (!name) {
      setError('Ward name is required.');
      return;
    }

    let parsedBoundary;
    try {
      parsedBoundary = JSON.parse(wardForm.boundaryJson || '{}');
    } catch {
      setError('Invalid GeoJSON format. Please check your boundary JSON.');
      return;
    }

    const normalizedDescription = wardForm.description.trim();
    const wardDraft = {
      name,
      description: normalizedDescription,
      boundary: parsedBoundary,
    };

    if (mode === 'update' && !selectedWardId) {
      setError('Select a ward boundary first before updating.');
      return;
    }

    if (mode === 'update') {
      if (!selectedWard) {
        setError('Selected ward no longer exists. Please select a ward again.');
        return;
      }

      if (isSameWardData(selectedWard, wardDraft)) {
        setError('No changes detected. Please edit ward data before updating.');
        return;
      }

      const duplicatedBoundaryWard = wards.find(
        (ward) => ward.ward_id !== selectedWardId && haveSameBoundaryGeometry(ward.boundary, parsedBoundary)
      );

      if (duplicatedBoundaryWard) {
        setError(`This GeoJSON boundary already exists in ward "${duplicatedBoundaryWard.name}".`);
        return;
      }
    }

    if (mode === 'add') {
      const duplicatedBoundaryWard = wards.find((ward) => haveSameBoundaryGeometry(ward.boundary, parsedBoundary));

      if (duplicatedBoundaryWard) {
        setError(`This GeoJSON boundary already exists in ward "${duplicatedBoundaryWard.name}".`);
        return;
      }
    }

    setSubmittingWard(true);

    try {
      const payload = {
        name,
        description: normalizedDescription,
        boundary: parsedBoundary,
      };

      if (mode === 'update') {
        payload.wardId = selectedWardId;
      }

      const savedWard = await upsertAdminWard(payload);
      await refreshWardsAndVenues();
      loadWardToEditor(savedWard);

      setOperationMessage(mode === 'update' ? 'Ward updated successfully.' : 'Ward added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not save ward data.');
    } finally {
      setSubmittingWard(false);
    }
  }

  async function handleDeleteWard() {
    if (!selectedWardId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete ward "${selectedWard?.name || selectedWardId}"?`);

    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingWard(true);

    try {
      await deleteAdminWard(selectedWardId);
      await refreshWardsAndVenues();
      prepareAddWard();
      setOperationMessage('Ward deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete ward.');
    } finally {
      setDeletingWard(false);
    }
  }

  function loadCategoryToEditor(category) {
    setSelectedCategoryId(category.id);
    setCategoryNameInput(category.name || '');
    setCategoryIconInput(String(category.icon || '').trim());
    setSelectedSubcategoryId(null);
    setSubcategoryNameInput('');
    setSubcategoryIconInput('');
  }

  function loadSubcategoryToEditor(category) {
    setSelectedSubcategoryId(category.id);
    setSubcategoryNameInput(category.name || '');
    setSubcategoryIconInput(String(category.icon || '').trim());
  }

  async function handleAddCategory() {
    const name = categoryNameInput.trim();
    const icon = String(categoryIconInput || '').trim();

    if (!name) {
      setError('Category name is required.');
      return;
    }

    if (!icon) {
      setError('Main category icon is required. Type an emoji or icon symbol.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const created = await createAdminPlaceCategory({
        name,
        slug: slugifyText(name),
        icon,
        parentId: null,
      });

      await refreshCategoriesAndVenues();
      setSelectedCategoryId(created.id);
      setCategoryNameInput(created.name || name);
      setCategoryIconInput(created.icon || icon);
      setSelectedSubcategoryId(null);
      setSubcategoryNameInput('');
      setSubcategoryIconInput('');
      setOperationMessage('Main category added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not add main category.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleUpdateCategory() {
    if (!selectedCategoryId) {
      setError('Select a category first before updating.');
      return;
    }

    if (!selectedCategory) {
      setError('Selected category no longer exists. Please select a category again.');
      return;
    }

    const name = categoryNameInput.trim();
    const icon = String(categoryIconInput || '').trim();
    if (!name) {
      setError('Main category name is required.');
      return;
    }

    if (!icon) {
      setError('Main category icon is required.');
      return;
    }

    if (normalizeComparableText(selectedCategory.name) === name && String(selectedCategory.icon || '').trim() === icon) {
      setError('No changes detected. Edit the main category before updating.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const updated = await updateAdminPlaceCategory(selectedCategoryId, {
        name,
        icon,
        parentId: null,
      });

      await refreshCategoriesAndVenues();
      setCategoryNameInput(updated.name || name);
      setCategoryIconInput(updated.icon || icon);
      setOperationMessage('Main category updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Could not update main category.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategoryId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete category "${selectedCategory?.name || categoryNameInput}"?`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingCategoryId(selectedCategoryId);

    try {
      await deleteAdminPlaceCategory(selectedCategoryId);
      await refreshCategoriesAndVenues();

      setSelectedCategoryId(null);
      setCategoryNameInput('');
      setCategoryIconInput('');
      setSelectedSubcategoryId(null);
      setSubcategoryNameInput('');
      setSubcategoryIconInput('');
      setOperationMessage('Main category deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete main category.');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  async function handleAddSubcategory() {
    if (!selectedCategory) {
      setError('Select a main category before adding a subcategory.');
      return;
    }

    const name = subcategoryNameInput.trim();
    const icon = String(subcategoryIconInput || '').trim();

    if (!name) {
      setError('Subcategory name is required.');
      return;
    }

    if (!icon) {
      setError('Subcategory icon is required.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const created = await createAdminPlaceCategory({
        name,
        icon,
        parentId: selectedCategory.id,
      });

      await refreshCategoriesAndVenues();
      setSelectedSubcategoryId(created.id);
      setSubcategoryNameInput(created.name || name);
      setSubcategoryIconInput(created.icon || icon);
      setOperationMessage('Subcategory added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not add subcategory.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleUpdateSubcategory() {
    if (!selectedCategory || !selectedSubcategory) {
      setError('Select a subcategory first before updating.');
      return;
    }

    const name = subcategoryNameInput.trim();
    const icon = String(subcategoryIconInput || '').trim();

    if (!name) {
      setError('Subcategory name is required.');
      return;
    }

    if (!icon) {
      setError('Subcategory icon is required.');
      return;
    }

    if (
      normalizeComparableText(selectedSubcategory.name) === name
      && String(selectedSubcategory.icon || '').trim() === icon
    ) {
      setError('No changes detected. Edit the subcategory before updating.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const updated = await updateAdminPlaceCategory(selectedSubcategory.id, {
        name,
        icon,
        parentId: selectedCategory.id,
      });

      await refreshCategoriesAndVenues();
      setSelectedSubcategoryId(updated.id);
      setSubcategoryNameInput(updated.name || name);
      setSubcategoryIconInput(updated.icon || icon);
      setOperationMessage('Subcategory updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Could not update subcategory.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleDeleteSubcategory() {
    if (!selectedSubcategory) {
      return;
    }

    const shouldDelete = window.confirm(`Delete subcategory "${selectedSubcategory.name || subcategoryNameInput}"?`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingCategoryId(selectedSubcategory.id);

    try {
      await deleteAdminPlaceCategory(selectedSubcategory.id);
      await refreshCategoriesAndVenues();
      setSelectedSubcategoryId(null);
      setSubcategoryNameInput('');
      setSubcategoryIconInput('');
      setOperationMessage('Subcategory deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete subcategory.');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  function loadServiceToEditor(service) {
    setSelectedServiceId(service.id);
    setServiceNameInput(service.name || '');
  }

  async function handleAddService() {
    const name = serviceNameInput.trim();

    if (!name) {
      setError('Service name is required.');
      return;
    }

    const nextSortOrder = merchantServices.reduce((maxOrder, service) => {
      const serviceOrder = Number(service.sort_order ?? service.sortOrder ?? 0);
      return Number.isFinite(serviceOrder) ? Math.max(maxOrder, serviceOrder) : maxOrder;
    }, 0) + 10;

    setError('');
    setOperationMessage('');
    setSubmittingService(true);

    try {
      const created = await createAdminMerchantService({
        name,
        slug: slugifyText(name),
        sortOrder: nextSortOrder,
      });

      await refreshMerchantServices();
      setSelectedServiceId(created.id);
      setServiceNameInput(created.name || name);
      setOperationMessage('Service added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not add service.');
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleUpdateService() {
    if (!selectedServiceId) {
      setError('Select a service first before updating.');
      return;
    }

    if (!selectedMerchantService) {
      setError('Selected service no longer exists. Please select a service again.');
      return;
    }

    const name = serviceNameInput.trim();
    if (!name) {
      setError('Service name is required.');
      return;
    }

    if (normalizeComparableText(selectedMerchantService.name) === name) {
      setError('No changes detected. Please edit service name before updating.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingService(true);

    try {
      const updated = await updateAdminMerchantService(selectedServiceId, {
        name,
      });

      await refreshMerchantServices();
      setServiceNameInput(updated.name || name);
      setOperationMessage('Service updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Could not update service.');
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleDeleteService() {
    if (!selectedServiceId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete service "${selectedMerchantService?.name || serviceNameInput}"?`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingServiceId(selectedServiceId);

    try {
      await deleteAdminMerchantService(selectedServiceId);
      await refreshMerchantServices();

      setSelectedServiceId(null);
      setServiceNameInput('');
      setOperationMessage('Service deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete service.');
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleModeration(venueId, action) {
    const venueToModerate = venues.find((item) => Number(item.id) === Number(venueId));
    const rejectionReason = String(rejectReasons[venueId] || '').trim();

    if (action === 'reject' && !rejectionReason) {
      setError('Rejection reason is required before rejecting this post.');
      return;
    }

    const venueDisplayName = venueToModerate?.title || venueToModerate?.name || `#${venueId}`;
    const confirmationMessage =
      action === 'approve'
        ? `Approve post "${venueDisplayName}"? This will add this location to the approved map.`
        : `Reject post "${venueDisplayName}"? This will keep the record and mark it as rejected.`;

    const shouldProceed = window.confirm(confirmationMessage);

    if (!shouldProceed) {
      return;
    }

    setError('');
    setOperationMessage('');

    setModeratingVenueId(venueId);

    try {
      const response = await moderateAdminVenue(venueId, {
        action,
        rejectionReason,
      });

      if (response.venue) {
        const updatedVenue = response.venue;
        setVenues((currentVenues) =>
          currentVenues.map((item) => (Number(item.id) === Number(updatedVenue.id) ? updatedVenue : item))
        );
      }

      if (action === 'reject') {
        setRejectReasons((currentReasons) => ({
          ...currentReasons,
          [venueId]: '',
        }));
      }

      setOperationMessage(response.message || 'Moderation status updated.');
      window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (moderateError) {
      setError(moderateError.response?.data?.message || 'Could not update moderation status.');
    } finally {
      setModeratingVenueId(null);
    }
  }

  async function handleUpdateRequestModeration(requestId, action) {
    const requestToModerate = pendingLocationUpdateRequests.find(
      (request) => Number(request.id) === Number(requestId)
    );
    const rejectionReason = String(updateRejectReasons[requestId] || '').trim();

    if (action === 'reject' && !rejectionReason) {
      setError('Rejection reason is required before rejecting an update request.');
      return;
    }

    const venueDisplayName =
      requestToModerate?.venue_title ||
      requestToModerate?.venue_name ||
      `Venue #${requestToModerate?.venue_id || 'N/A'}`;
    const confirmationMessage =
      action === 'approve'
        ? `Approve update request for "${venueDisplayName}"? This will apply the proposed location and details.`
        : `Reject update request for "${venueDisplayName}"? This will keep the current venue location and details.`;

    const shouldProceed = window.confirm(confirmationMessage);
    if (!shouldProceed) {
      return;
    }

    setError('');
    setOperationMessage('');
    setModeratingUpdateRequestId(requestId);

    try {
      const response = await moderateAdminVenueUpdateRequest(requestId, {
        action,
        rejectionReason,
      });

      if (response?.venue) {
        setVenues((currentVenues) =>
          currentVenues.map((item) =>
            Number(item.id) === Number(response.venue.id) ? { ...item, ...response.venue } : item
          )
        );
      }

      await refreshPendingModerationData();

      if (action === 'reject') {
        setUpdateRejectReasons((currentReasons) => ({
          ...currentReasons,
          [requestId]: ''
        }));
      }

      if (action === 'approve' && response?.venue?.id) {
        setPendingQueueView('submissions');
        setSelectedVenueId(response.venue.id);
        setSelectedUpdateRequestId(null);
        setSelectedUpdateLocationView('new');
        setIsSubmissionDetailClosed(false);
      } else if (Number(selectedUpdateRequestId) === Number(requestId)) {
        setSelectedUpdateRequestId(null);
      }

      setOperationMessage(response?.message || 'Update request moderation completed.');
      window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (moderateError) {
      setError(moderateError.response?.data?.message || 'Could not moderate update request.');
    } finally {
      setModeratingUpdateRequestId(null);
    }
  }

  function handleAdminVenueCommentMediaChange(selectedFiles) {
    const nextFiles = Array.isArray(selectedFiles)
      ? selectedFiles.filter((file) => String(file?.type || '').startsWith('image/'))
      : [];

    setAdminVenueCommentMediaFiles((currentFiles) => [...currentFiles, ...nextFiles].slice(0, 3));
  }

  function handleRemoveAdminVenueCommentMedia(targetFileId) {
    setAdminVenueCommentMediaFiles((currentFiles) =>
      currentFiles.filter((file) => `${file.name}-${file.lastModified}-${file.size}` !== targetFileId)
    );
  }

  async function handlePostAdminVenueComment() {
    const normalizedVenueId = Number(selectedVenue?.id);
    const comment = String(adminVenueCommentDraft.comment || '').trim();
    const title = String(adminVenueCommentDraft.title || '').trim();

    if (!Number.isFinite(normalizedVenueId)) {
      setError('Select a valid venue before posting a comment.');
      return;
    }

    if (!comment) {
      setError('Comment content cannot be empty.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingAdminVenueComment(true);

    try {
      const payload = new FormData();
      payload.append('comment', comment);
      if (title) {
        payload.append('title', title);
      }

      adminVenueCommentMediaFiles.forEach((file) => {
        payload.append('images', file);
      });

      await createAdminVenueReview(normalizedVenueId, payload);

      setAdminVenueCommentDraft({ title: '', comment: '' });
      setAdminVenueCommentMediaFiles([]);

      const refreshedReviews = await fetchAdminVenueReviews(normalizedVenueId, {
        sort: selectedVenueReviewSort,
      });

      setSelectedVenueReviews(Array.isArray(refreshedReviews?.items) ? refreshedReviews.items : []);
      setSelectedVenueReviewsError('');
      setOperationMessage('Comment posted.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Could not post comment.');
    } finally {
      setSubmittingAdminVenueComment(false);
    }
  }

  function handleToggleAdminReviewReplyComposer(reviewId, authorName = '', replyId = null) {
    const normalizedReviewId = Number(reviewId);
    const hasReplyId = replyId !== null && replyId !== undefined && String(replyId).trim() !== '';
    const normalizedReplyId = hasReplyId ? Number(replyId) : NaN;
    const nextReplyId = Number.isFinite(normalizedReplyId) ? normalizedReplyId : null;
    if (!Number.isFinite(normalizedReviewId)) {
      return;
    }

    setError('');
    setOperationMessage('');
    setActiveAdminReplyTarget((currentTarget) => {
      const currentReviewId = Number(currentTarget?.reviewId);
      const currentRawReplyId = currentTarget?.replyId;
      const hasCurrentReplyId =
        currentRawReplyId !== null
        && currentRawReplyId !== undefined
        && String(currentRawReplyId).trim() !== '';
      const currentReplyId = hasCurrentReplyId ? Number(currentRawReplyId) : NaN;
      const isSameReview = Number.isFinite(currentReviewId) && currentReviewId === normalizedReviewId;
      const isSameReply =
        (nextReplyId === null && !hasCurrentReplyId)
        || (Number.isFinite(nextReplyId) && Number.isFinite(currentReplyId) && currentReplyId === nextReplyId);
      const shouldClose = isSameReview && isSameReply;

      if (shouldClose) {
        return null;
      }

      setAdminReviewReplyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [normalizedReviewId]: buildDefaultAdminReplyDraft(authorName),
      }));
      setAdminReviewReplyMediaDrafts((currentDrafts) => ({
        ...currentDrafts,
        [normalizedReviewId]: [],
      }));

      return {
        reviewId: normalizedReviewId,
        replyId: nextReplyId,
        replyToName: String(authorName || '').trim(),
      };
    });
  }

  async function handlePostAdminReviewReply(reviewId) {
    const normalizedVenueId = Number(selectedVenue?.id);
    const normalizedReviewId = Number(reviewId);
    const replyDraft = adminReviewReplyDrafts[normalizedReviewId] || buildDefaultAdminReplyDraft();
    const replyTitle = String(replyDraft.title || '').trim();
    const replyContent = String(replyDraft.content || '').trim();
    const replyMediaFiles = Array.isArray(adminReviewReplyMediaDrafts[normalizedReviewId])
      ? adminReviewReplyMediaDrafts[normalizedReviewId]
      : [];

    if (!Number.isFinite(normalizedVenueId) || !Number.isFinite(normalizedReviewId)) {
      setError('Select a valid venue review before posting an admin comment.');
      return;
    }

    if (!replyContent) {
      setError('Admin comment cannot be empty.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSendingReviewReplyId(normalizedReviewId);

    try {
      const payload = new FormData();
      payload.append('content', replyContent);
      if (replyTitle) {
        payload.append('title', replyTitle);
      }
      replyMediaFiles.forEach((file) => {
        payload.append('images', file);
      });

      await createAdminVenueReviewReply(normalizedVenueId, normalizedReviewId, payload);

      setAdminReviewReplyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [normalizedReviewId]: buildDefaultAdminReplyDraft(),
      }));
      setAdminReviewReplyMediaDrafts((currentDrafts) => ({
        ...currentDrafts,
        [normalizedReviewId]: [],
      }));
      setActiveAdminReplyTarget(null);

      const refreshedReviews = await fetchAdminVenueReviews(normalizedVenueId, {
        sort: selectedVenueReviewSort,
      });

      setSelectedVenueReviews(Array.isArray(refreshedReviews?.items) ? refreshedReviews.items : []);
      setSelectedVenueReviewsError('');
      setOperationMessage('Admin comment posted.');
    } catch (replyError) {
      setError(replyError.response?.data?.message || 'Could not post admin comment.');
    } finally {
      setSendingReviewReplyId(null);
    }
  }

  function handleAdminReplyMediaChange(reviewId, selectedFiles) {
    const normalizedReviewId = Number(reviewId);
    if (!Number.isFinite(normalizedReviewId)) {
      return;
    }

    const nextFiles = Array.isArray(selectedFiles)
      ? selectedFiles.filter((file) => String(file?.type || '').startsWith('image/'))
      : [];

    setAdminReviewReplyMediaDrafts((currentDrafts) => {
      const currentFiles = Array.isArray(currentDrafts[normalizedReviewId])
        ? currentDrafts[normalizedReviewId]
        : [];
      return {
        ...currentDrafts,
        [normalizedReviewId]: [...currentFiles, ...nextFiles].slice(0, 3),
      };
    });
  }

  function handleRemoveAdminReplyMedia(reviewId, targetFileId) {
    const normalizedReviewId = Number(reviewId);
    if (!Number.isFinite(normalizedReviewId)) {
      return;
    }

    setAdminReviewReplyMediaDrafts((currentDrafts) => {
      const currentFiles = Array.isArray(currentDrafts[normalizedReviewId])
        ? currentDrafts[normalizedReviewId]
        : [];

      return {
        ...currentDrafts,
        [normalizedReviewId]: currentFiles.filter(
          (file) => `${file.name}-${file.lastModified}-${file.size}` !== targetFileId
        ),
      };
    });
  }

  function renderAdminReviewReplyComposer(reviewId, reviewAuthorName, contextLabel = '') {
    const normalizedReviewId = Number(reviewId);

    if (!Number.isFinite(normalizedReviewId)) {
      return null;
    }

    const replyDraftForm = adminReviewReplyDrafts[normalizedReviewId] || buildDefaultAdminReplyDraft(reviewAuthorName);
    const replyDraftTitle = String(replyDraftForm.title || '');
    const replyDraftContent = String(replyDraftForm.content || '');
    const replyMediaDraftFiles = Array.isArray(adminReviewReplyMediaDrafts[normalizedReviewId])
      ? adminReviewReplyMediaDrafts[normalizedReviewId]
      : [];

    return (
      <div className="admin-review-reply-form">
        {contextLabel ? <p className="admin-review-reply-context">{contextLabel}</p> : null}

        <input
          type="text"
          value={replyDraftTitle}
          placeholder="Title"
          onChange={(event) =>
            setAdminReviewReplyDrafts((currentDrafts) => ({
              ...currentDrafts,
              [normalizedReviewId]: {
                ...buildDefaultAdminReplyDraft(reviewAuthorName),
                ...(currentDrafts[normalizedReviewId] || {}),
                title: event.target.value,
              },
            }))
          }
        />

        <textarea
          id={`admin-review-reply-${normalizedReviewId}`}
          rows={2}
          value={replyDraftContent}
          placeholder="Write a comment..."
          onChange={(event) =>
            setAdminReviewReplyDrafts((currentDrafts) => ({
              ...currentDrafts,
              [normalizedReviewId]: {
                ...buildDefaultAdminReplyDraft(reviewAuthorName),
                ...(currentDrafts[normalizedReviewId] || {}),
                content: event.target.value,
              },
            }))
          }
        />

        <label className="admin-review-reply-upload-label" htmlFor={`admin-review-reply-upload-${normalizedReviewId}`}>
          Upload images (max 3)
        </label>
        <input
          id={`admin-review-reply-upload-${normalizedReviewId}`}
          type="file"
          accept="image/*"
          multiple
          className="admin-review-reply-upload"
          onChange={(event) => {
            handleAdminReplyMediaChange(normalizedReviewId, Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />

        {replyMediaDraftFiles.length ? (
          <div className="admin-review-reply-media-list">
            {replyMediaDraftFiles.map((file) => {
              const fileId = `${file.name}-${file.lastModified}-${file.size}`;
              return (
                <div key={fileId} className="admin-review-reply-media-item">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="admin-review-reply-media-remove"
                    onClick={() => handleRemoveAdminReplyMedia(normalizedReviewId, fileId)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          className="action-secondary"
          disabled={
            sendingReviewReplyId === normalizedReviewId
            || !String(replyDraftContent).trim()
          }
          onClick={() => handlePostAdminReviewReply(normalizedReviewId)}
        >
          {sendingReviewReplyId === normalizedReviewId ? 'Posting...' : 'Post comment'}
        </button>
      </div>
    );
  }

  async function handleDeleteAdminReview(reviewId) {
    const normalizedVenueId = Number(selectedVenue?.id);
    const normalizedReviewId = Number(reviewId);

    if (!Number.isFinite(normalizedVenueId) || !Number.isFinite(normalizedReviewId)) {
      setError('Select a valid review before deleting.');
      return;
    }

    const shouldDelete = window.confirm('Delete this review? Admin can delete any review.');
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingReviewId(normalizedReviewId);

    try {
      await deleteAdminVenueReview(normalizedVenueId, normalizedReviewId);

      const refreshedReviews = await fetchAdminVenueReviews(normalizedVenueId, {
        sort: selectedVenueReviewSort,
      });

      setSelectedVenueReviews(Array.isArray(refreshedReviews?.items) ? refreshedReviews.items : []);
      setSelectedVenueReviewsError('');
      setOperationMessage('Review deleted by admin.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete review.');
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleDeleteAdminReviewReply(reviewId, replyId) {
    const normalizedVenueId = Number(selectedVenue?.id);
    const normalizedReviewId = Number(reviewId);
    const normalizedReplyId = Number(replyId);

    if (!Number.isFinite(normalizedVenueId) || !Number.isFinite(normalizedReviewId) || !Number.isFinite(normalizedReplyId)) {
      setError('Select a valid reply before deleting.');
      return;
    }

    const shouldDelete = window.confirm('Delete this reply comment? Admin can delete any reply.');
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingReplyId(normalizedReplyId);

    try {
      await deleteAdminVenueReviewReply(normalizedVenueId, normalizedReviewId, normalizedReplyId);

      const refreshedReviews = await fetchAdminVenueReviews(normalizedVenueId, {
        sort: selectedVenueReviewSort,
      });

      setSelectedVenueReviews(Array.isArray(refreshedReviews?.items) ? refreshedReviews.items : []);
      setSelectedVenueReviewsError('');
      setOperationMessage('Reply deleted by admin.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete reply.');
    } finally {
      setDeletingReplyId(null);
    }
  }

  function handleOpenVenueDetails(venueId) {
    setIsSubmissionDetailClosed(false);
    setSelectedVenueId(venueId);
    setSelectedVenueImageIndex(0);
    setExpandedImageUrl('');
  }

  function handleOpenUpdateRequestDetails(requestId) {
    setIsSubmissionDetailClosed(false);
    setSelectedUpdateRequestId(requestId);
    setSelectedUpdateLocationView('new');
    setSelectedVenueImageIndex(0);
    setExpandedImageUrl('');
  }

  function handlePreviousVenueImage() {
    if (activeDetailGalleryImages.length <= 1) {
      return;
    }

    setSelectedVenueImageIndex((currentIndex) =>
      currentIndex === 0 ? activeDetailGalleryImages.length - 1 : currentIndex - 1
    );
  }

  function handleNextVenueImage() {
    if (activeDetailGalleryImages.length <= 1) {
      return;
    }

    setSelectedVenueImageIndex((currentIndex) => (currentIndex + 1) % activeDetailGalleryImages.length);
  }

  function resolveMarkerIcon(venue) {
    if (activeMode === 'category') {
      const categoryIcon = placeCategoryById.get(Number(venue.category_id))?.icon;
      return resolveCategoryIcon(venue.category_id, categoryIcon);
    }

    return resolveStatusIcon(venue.status);
  }

  function renderLeftPanel() {
    if (activeMode === 'pending') {
      return (
        <div className="admin-list-panel">
          <div className="admin-pending-queue-switch" role="tablist" aria-label={tx('Pending queues')}>
            <button
              type="button"
              className={`admin-pending-queue-tab ${pendingQueueView === 'submissions' ? 'is-active' : ''}`.trim()}
              onClick={() => handlePendingQueueViewChange('submissions')}
            >
              <span className="admin-pending-queue-tab-label">{tx('Pending Queue')}</span>
              <span className="admin-pending-queue-tab-count">{pendingQueueVenues.length}</span>
            </button>
            <button
              type="button"
              className={`admin-pending-queue-tab ${pendingQueueView === 'updates' ? 'is-active' : ''}`.trim()}
              onClick={() => handlePendingQueueViewChange('updates')}
            >
              <span className="admin-pending-queue-tab-label">{tx('Location Updates')}</span>
              <span className="admin-pending-queue-tab-count">{pendingLocationUpdateRequests.length}</span>
            </button>
          </div>

          <div className="admin-scroll-list">
            {pendingQueueView === 'updates'
              ? pendingLocationUpdateRequests.map((request) => {
                  const proposedSnapshot = normalizeVenueUpdateSnapshot(request.proposed_snapshot);
                  return (
                    <button
                      key={request.id}
                      type="button"
                      className={`admin-list-item ${Number(selectedUpdateRequestId) === Number(request.id) ? 'is-active' : ''}`.trim()}
                      onClick={() => handleOpenUpdateRequestDetails(request.id)}
                    >
                      <strong>
                        {request.has_priority_approval ? <span className="admin-priority-star-badge">★ {tx('Priority')}</span> : null}
                        <span className="admin-list-item-title">
                          {request.venue_title || request.venue_name || `Venue #${request.venue_id}`}
                        </span>
                      </strong>
                      <span className="admin-list-item-address">
                        {proposedSnapshot.address || request.venue_address || 'Address pending'}
                      </span>
                      <small className="admin-list-item-timestamp">
                        {formatDateTime(request.submitted_at || request.created_at, locale, tx)}
                      </small>
                    </button>
                  );
                })
              : pendingQueueVenues.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    className={`admin-list-item ${isPriorityApprovalVenue(venue) ? 'is-priority' : ''} ${Number(selectedVenueId) === Number(venue.id) ? 'is-active' : ''}`.trim()}
                    onClick={() => handleOpenVenueDetails(venue.id)}
                  >
                    <strong>
                      {isPriorityApprovalVenue(venue) ? <span className="admin-priority-star-badge">★ {tx('Priority')}</span> : null}
                      <span className="admin-list-item-title">{venue.title || venue.name}</span>
                    </strong>
                    <span className="admin-list-item-address">{venue.address || tx('Address pending')}</span>
                    <small className="admin-list-item-timestamp">{formatDateTime(venue.submitted_at, locale, tx)}</small>
                  </button>
                ))}

            {pendingQueueView === 'updates' && !pendingLocationUpdateRequests.length ? (
              <p className="admin-empty-note">{tx('No location update requests right now.')}</p>
            ) : null}

            {pendingQueueView === 'submissions' && !pendingQueueVenues.length ? (
              <p className="admin-empty-note">
                {pendingActiveFilterCount ? tx('No pending posts match your filters.') : tx('No pending posts right now.')}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'ward') {
      return (
        <div className="admin-list-panel">
          <header>
            <h3>Ward Boundaries</h3>
            <p>Click from this list or click a polygon directly on the map.</p>
          </header>

          <div className="admin-scroll-list">
            {wards.map((ward) => (
              <button
                key={ward.ward_id}
                type="button"
                className={`admin-list-item ${selectedWardId === ward.ward_id ? 'is-active' : ''}`.trim()}
                onClick={() => loadWardToEditor(ward)}
              >
                <strong>{ward.name}</strong>
                <small>{formatDateTime(ward.updated_at || ward.created_at)}</small>
              </button>
            ))}

            {!wards.length ? <p className="admin-empty-note">No wards available yet.</p> : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'service') {
      return (
        <div className="admin-list-panel">
          <header>
            <h3>Merchant Services</h3>
            <p>{merchantServices.length} service option(s)</p>
          </header>

          <div className="admin-scroll-list">
            {merchantServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`admin-list-item ${Number(selectedServiceId) === Number(service.id) ? 'is-active' : ''}`.trim()}
                onClick={() => loadServiceToEditor(service)}
              >
                <strong>{service.name}</strong>
                <span>{serviceUsageCountById.get(Number(service.id)) || 0} venue(s) using this service</span>
                <small>{service.slug}</small>
              </button>
            ))}

            {!merchantServices.length ? <p className="admin-empty-note">No merchant services yet.</p> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="admin-list-panel">
        <header>
          <h3>Main Categories</h3>
          <p>Select a main category to manage its subcategories and preview matching markers.</p>
        </header>

        <div className="admin-scroll-list">
          {rootPlaceCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`admin-list-item ${Number(selectedCategoryId) === Number(category.id) ? 'is-active' : ''}`.trim()}
              onClick={() => loadCategoryToEditor(category)}
            >
              <strong>
                <span className="category-icon-dot" aria-hidden="true">
                  {normalizeCategoryIcon(category.icon)}
                </span>
                {category.name}
              </strong>
              <span>
                {selectedCategoryId === category.id
                  ? 'Currently managing this main category'
                  : `${(childCategoriesByParentId.get(Number(category.id)) || []).length} subcategories available`}
              </span>
              <small>{categoryUsageCountById.get(Number(category.id)) || 0} venue(s) assigned directly</small>
            </button>
          ))}

          {!rootPlaceCategories.length ? <p className="admin-empty-note">No main categories yet.</p> : null}
        </div>
      </div>
    );
  }

  function renderRightPanel() {
    if (activeMode === 'pending') {
      if (pendingQueueView === 'updates') {
        const oldWardName =
          wards.find((ward) => String(ward.ward_id) === String(selectedUpdateOldSnapshot.wardId))?.name ||
          selectedUpdateOldSnapshot.wardId ||
          'Not provided';
        const newWardName =
          wards.find((ward) => String(ward.ward_id) === String(selectedUpdateProposedSnapshot.wardId))?.name ||
          selectedUpdateProposedSnapshot.wardId ||
          'Not provided';
        const oldCategoryName = formatVenueUpdateCategoryLabel(
          selectedUpdateOldSnapshot,
          placeCategoryTree,
          String(selectedUpdateRequest?.venue_category_name || '').trim() || 'Not provided'
        );
        const newCategoryName = formatVenueUpdateCategoryLabel(
          selectedUpdateProposedSnapshot,
          placeCategoryTree,
          oldCategoryName
        );
        const activeWardName = selectedUpdateLocationView === 'old' ? oldWardName : newWardName;
        const activeCategoryName = selectedUpdateLocationView === 'old' ? oldCategoryName : newCategoryName;
        const submitterEmail =
          String(selectedUpdateRequest?.submitted_by_email || '').trim() ||
          String(selectedUpdateRequest?.submitted_by_user_id || '').trim() ||
          'Not provided';
        const submitterFullName =
          String(selectedUpdateRequest?.submitted_by_full_name || '').trim() ||
          'Not provided';
        const isRejectReasonProvided =
          Boolean(String(updateRejectReasons[selectedUpdateRequest?.id] || '').trim());
        const changedFieldMap = {
          name: hasUpdateFieldChanged(
            selectedUpdateOldSnapshot.title || selectedUpdateOldSnapshot.name,
            selectedUpdateProposedSnapshot.title || selectedUpdateProposedSnapshot.name
          ),
          address: hasUpdateFieldChanged(selectedUpdateOldSnapshot.address, selectedUpdateProposedSnapshot.address),
          ward: hasUpdateFieldChanged(selectedUpdateOldSnapshot.wardId, selectedUpdateProposedSnapshot.wardId),
          category: hasUpdateFieldChanged(selectedUpdateOldSnapshot.categoryId, selectedUpdateProposedSnapshot.categoryId),
          phone: hasUpdateFieldChanged(selectedUpdateOldSnapshot.phone, selectedUpdateProposedSnapshot.phone),
          contactEmail: hasUpdateFieldChanged(
            selectedUpdateOldSnapshot.metadata?.contactEmail,
            selectedUpdateProposedSnapshot.metadata?.contactEmail
          ),
          latitude: hasUpdateFieldChanged(selectedUpdateOldSnapshot.latitude, selectedUpdateProposedSnapshot.latitude),
          longitude: hasUpdateFieldChanged(selectedUpdateOldSnapshot.longitude, selectedUpdateProposedSnapshot.longitude),
          priceRange: hasUpdateFieldChanged(
            [selectedUpdateOldSnapshot.metadata?.minPrice, selectedUpdateOldSnapshot.metadata?.maxPrice],
            [selectedUpdateProposedSnapshot.metadata?.minPrice, selectedUpdateProposedSnapshot.metadata?.maxPrice]
          ),
          operatingHours: hasUpdateFieldChanged(
            formatMetadataOperatingHours(selectedUpdateOldSnapshot?.metadata, tx),
            formatMetadataOperatingHours(selectedUpdateProposedSnapshot?.metadata, tx)
          ),
          gallery: hasUpdateFieldChanged(
            extractUpdateSnapshotGalleryImages(selectedUpdateOldSnapshot),
            extractUpdateSnapshotGalleryImages(selectedUpdateProposedSnapshot)
          ),
          verification: hasUpdateFieldChanged(
            selectedUpdateOldSnapshot.businessLicenseImageUrl,
            selectedUpdateProposedSnapshot.businessLicenseImageUrl
          )
        };
        const shouldShowNewBadge = (fieldKey) => (
          selectedUpdateLocationView === 'new' && Boolean(changedFieldMap[fieldKey])
        );

        return (
          <div className="admin-detail-panel">
            <header className="admin-detail-panel-header">
              {selectedUpdateRequest ? (
                <button
                  type="button"
                  className="admin-detail-close-btn"
                  onClick={() => {
                    setIsSubmissionDetailClosed(true);
                    setSelectedUpdateRequestId(null);
                    setExpandedImageUrl('');
                  }}
                  aria-label="Close location update detail"
                >
                  ×
                </button>
              ) : null}
            </header>

            {!selectedUpdateRequest ? (
              <p className="admin-empty-note">Select a location update request from the queue.</p>
            ) : (
              <div className="admin-detail-stack">
                <h4>{selectedUpdateRequest.venue_title || selectedUpdateRequest.venue_name || `Venue #${selectedUpdateRequest.venue_id}`}</h4>
                <p>{tx('Requested at')} {formatDateTime(selectedUpdateRequest.submitted_at || selectedUpdateRequest.created_at, locale, tx)}</p>
                <p className="admin-update-submitter">Submitted by: {submitterFullName} ({submitterEmail})</p>

                <div className="admin-location-version-toggle" role="tablist" aria-label="Location version">
                  <button
                    type="button"
                    className={`admin-location-version-btn ${selectedUpdateLocationView === 'old' ? 'is-active' : ''}`.trim()}
                    onClick={() => setSelectedUpdateLocationView('old')}
                  >
                    Old Location
                  </button>
                  <button
                    type="button"
                    className={`admin-location-version-btn ${selectedUpdateLocationView === 'new' ? 'is-active' : ''}`.trim()}
                    onClick={() => setSelectedUpdateLocationView('new')}
                  >
                    New Location
                  </button>
                </div>

                <p className="admin-update-view-note">
                  {selectedUpdateLocationView === 'old'
                    ? 'Map marker is focused on old location (teal).'
                    : 'Map marker is focused on new location (dark orange).'}
                </p>

                {selectedUpdateActiveImage ? (
                  <div className="admin-image-carousel">
                    <button
                      type="button"
                      className="admin-carousel-btn"
                      onClick={handlePreviousVenueImage}
                      disabled={selectedUpdateActiveGalleryImages.length <= 1}
                      aria-label="Show previous image"
                    >
                      ‹
                    </button>

                    <button
                      type="button"
                      className="admin-carousel-image-wrap"
                      onClick={() => setExpandedImageUrl(resolveAssetUrl(selectedUpdateActiveImage))}
                      aria-label="Open image preview"
                    >
                      <img
                        src={resolveAssetUrl(selectedUpdateActiveImage)}
                        alt={`${selectedUpdateLocationView === 'old' ? 'Old' : 'New'} location preview`}
                        className="admin-detail-image admin-detail-image-clickable"
                      />
                    </button>

                    <button
                      type="button"
                      className="admin-carousel-btn"
                      onClick={handleNextVenueImage}
                      disabled={selectedUpdateActiveGalleryImages.length <= 1}
                      aria-label="Show next image"
                    >
                      ›
                    </button>

                    <p className="admin-carousel-counter">
                      {Math.min(selectedVenueImageIndex + 1, Math.max(selectedUpdateActiveGalleryImages.length, 1))}
                      {' / '}
                      {Math.max(selectedUpdateActiveGalleryImages.length, 1)}
                    </p>
                  </div>
                ) : (
                  <div className="admin-detail-image-placeholder">
                    {selectedUpdateLocationView === 'old' ? tx('No old images') : tx('No new images')}
                  </div>
                )}

                <div className={`admin-update-compare-column ${selectedUpdateLocationView === 'new' ? 'is-proposed' : ''}`.trim()}>
                  <h5>{selectedUpdateLocationView === 'old' ? tx('Old Location Data') : tx('New Location Data')}</h5>
                  <ul className="admin-detail-meta">
                    <li>
                      Name: {selectedUpdateActiveSnapshot.title || selectedUpdateActiveSnapshot.name || 'Not provided'}
                      {shouldShowNewBadge('name') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Address: {selectedUpdateActiveSnapshot.address || 'Not provided'}
                      {shouldShowNewBadge('address') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Ward: {activeWardName}
                      {shouldShowNewBadge('ward') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Category: {activeCategoryName}
                      {shouldShowNewBadge('category') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Phone: {selectedUpdateActiveSnapshot.phone || 'Not provided'}
                      {shouldShowNewBadge('phone') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Contact email: {selectedUpdateActiveSnapshot.metadata?.contactEmail || 'Not provided'}
                      {shouldShowNewBadge('contactEmail') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Latitude: {formatCoordinate(selectedUpdateActiveSnapshot.latitude)}
                      {shouldShowNewBadge('latitude') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Longitude: {formatCoordinate(selectedUpdateActiveSnapshot.longitude)}
                      {shouldShowNewBadge('longitude') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Price range:
                      {' '}
                      {formatCurrencyVnd(selectedUpdateActiveSnapshot.metadata.minPrice)} - {formatCurrencyVnd(selectedUpdateActiveSnapshot.metadata.maxPrice)}
                      {shouldShowNewBadge('priceRange') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Operating hours: {selectedUpdateActiveOperatingHours}
                      {shouldShowNewBadge('operatingHours') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Gallery images: {selectedUpdateActiveGalleryImages.length || 0}
                      {shouldShowNewBadge('gallery') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                    <li>
                      Verification: {selectedUpdateActiveBusinessLicenseImage ? 'Uploaded' : 'Missing'}
                      {shouldShowNewBadge('verification') ? <span className="admin-field-new-badge">NEW</span> : null}
                    </li>
                  </ul>

                  {selectedUpdateActiveSnapshot.description ? <p>{selectedUpdateActiveSnapshot.description}</p> : null}

                  {selectedUpdateActiveWeeklySchedule.length ? (
                    <div className="admin-service-summary">
                      <strong>Weekly schedule</strong>
                      <ul className="admin-detail-meta">
                        {selectedUpdateActiveWeeklySchedule.map((daySchedule) => (
                          <li key={`${selectedUpdateLocationView}-${daySchedule}`}>{daySchedule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedUpdateActiveServiceNames.length ? (
                    <div className="admin-service-chip-list">
                      {selectedUpdateActiveServiceNames.map((serviceName) => (
                        <span key={`${selectedUpdateLocationView}-${serviceName}`} className="admin-service-chip">{serviceName}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty-note">
                      {selectedUpdateLocationView === 'old'
                        ? 'No old services listed.'
                        : 'No new services listed.'}
                    </p>
                  )}

                  {selectedUpdateActiveBusinessLicenseImage ? (
                    <div className="admin-license-preview admin-verification-preview">
                      <p>Verification image</p>
                      <button
                        type="button"
                        className="admin-license-image-wrap"
                        onClick={() => setExpandedImageUrl(resolveAssetUrl(selectedUpdateActiveBusinessLicenseImage))}
                      >
                        <img
                          src={resolveAssetUrl(selectedUpdateActiveBusinessLicenseImage)}
                          alt={`${selectedUpdateLocationView === 'old' ? 'Old' : 'New'} business license`}
                          className="admin-detail-image admin-detail-image-clickable"
                        />
                      </button>
                    </div>
                  ) : (
                    <p className="admin-empty-note">No verification image provided in this snapshot.</p>
                  )}
                </div>

                <div className="admin-form-field">
                  <label htmlFor="updateRejectionReason">Rejection Reason (Optional)</label>
                  <textarea
                    id="updateRejectionReason"
                    value={updateRejectReasons[selectedUpdateRequest.id] || ''}
                    onChange={(event) =>
                      setUpdateRejectReasons((currentReasons) => ({
                        ...currentReasons,
                        [selectedUpdateRequest.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Required before rejecting this update request."
                  />
                </div>

                <div className="admin-action-row">
                  <button
                    type="button"
                    className="action-approve"
                    disabled={moderatingUpdateRequestId === selectedUpdateRequest.id}
                    onClick={() => handleUpdateRequestModeration(selectedUpdateRequest.id, 'approve')}
                  >
                    {moderatingUpdateRequestId === selectedUpdateRequest.id ? tx('Updating...') : tx('Approve Post')}
                  </button>

                  <button
                    type="button"
                    className="action-reject"
                    disabled={
                      moderatingUpdateRequestId === selectedUpdateRequest.id ||
                      !isRejectReasonProvided
                    }
                    onClick={() => handleUpdateRequestModeration(selectedUpdateRequest.id, 'reject')}
                  >
                    Reject Post
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }

      const selectedVenueStatus = String(selectedVenue?.status || '').toLowerCase();

      return (
        <div className="admin-detail-panel">
          <header className="admin-detail-panel-header">
            {selectedVenue ? (
              <button
                type="button"
                className="admin-detail-close-btn"
                onClick={() => {
                  setIsSubmissionDetailClosed(true);
                  setSelectedVenueId(null);
                  setExpandedImageUrl('');
                }}
                aria-label="Close submission detail"
              >
                ×
              </button>
            ) : null}
          </header>

          {!selectedVenue ? (
            <p className="admin-empty-note">Select a pending post from the queue.</p>
          ) : (
            <div className="admin-detail-stack">
              {selectedVenueActiveImage ? (
                <div className="admin-image-carousel">
                  <button
                    type="button"
                    className="admin-carousel-btn"
                    onClick={handlePreviousVenueImage}
                    disabled={selectedVenueGalleryImages.length <= 1}
                    aria-label="Show previous image"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    className="admin-carousel-image-wrap"
                    onClick={() => setExpandedImageUrl(selectedVenueActiveImage)}
                    aria-label="Open image preview"
                  >
                    <img
                      src={selectedVenueActiveImage}
                      alt={selectedVenue.title || selectedVenue.name}
                      className="admin-detail-image admin-detail-image-clickable"
                    />
                  </button>

                  <button
                    type="button"
                    className="admin-carousel-btn"
                    onClick={handleNextVenueImage}
                    disabled={selectedVenueGalleryImages.length <= 1}
                    aria-label="Show next image"
                  >
                    ›
                  </button>

                  <p className="admin-carousel-counter">
                    {Math.min(selectedVenueImageIndex + 1, Math.max(selectedVenueGalleryImages.length, 1))}
                    {' / '}
                    {Math.max(selectedVenueGalleryImages.length, 1)}
                  </p>
                </div>
              ) : (
                <div className="admin-detail-image-placeholder">No cover image</div>
              )}

              <h4 className="admin-submission-title">
                <span>{selectedVenue.title || selectedVenue.name}</span>
                {isPriorityApprovalVenue(selectedVenue) ? <span className="admin-priority-star-badge is-detail">★ Priority</span> : null}
              </h4>
              <p>{selectedVenue.address || 'Address pending'}</p>

              <div className="admin-detail-tabs" role="tablist" aria-label="Submission detail sections">
                <button
                  type="button"
                  className={`admin-detail-tab-btn ${activeDetailTab === 'overview' ? 'is-active' : ''}`.trim()}
                  onClick={() => setActiveDetailTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`admin-detail-tab-btn ${activeDetailTab === 'introduction' ? 'is-active' : ''}`.trim()}
                  onClick={() => setActiveDetailTab('introduction')}
                >
                  Introduction
                </button>
                <button
                  type="button"
                  className={`admin-detail-tab-btn ${activeDetailTab === 'images' ? 'is-active' : ''}`.trim()}
                  onClick={() => setActiveDetailTab('images')}
                >
                  Images
                </button>
                <button
                  type="button"
                  className={`admin-detail-tab-btn ${activeDetailTab === 'rating' ? 'is-active' : ''}`.trim()}
                  onClick={() => setActiveDetailTab('rating')}
                >
                  Rating
                </button>
              </div>

              {activeDetailTab === 'overview' ? (
                <div className="admin-extra-detail-block">
                  <ul className="admin-detail-meta">
                    <li>Venue ID: {selectedVenue.id}</li>
                    <li>{tx('Name:')} {selectedVenue.name || tx('Not provided')}</li>
                    <li>{tx('Ward:')} {selectedVenue.ward_name || selectedVenue.ward_id || tx('Not detected')}</li>
                    <li>{tx('Category:')} {formatVenueCategoryLabel(selectedVenue, placeCategoryTree)}</li>
                    <li>{tx('Status:')} {statusLabel(selectedVenue.status, tx)}</li>
                    <li>{tx('Submitter full name:')} {selectedVenue.submitter_full_name || selectedVenue.owner_name || tx('Not provided')}</li>
                    <li>{tx('Submitter email:')} {selectedVenue.submitter_email || selectedVenue.submitted_by_user_id || tx('Not provided')}</li>
                    <li>{tx('Phone:')} {selectedVenue.phone || tx('Not provided')}</li>
                    <li>{tx('Submitted:')} {formatDateTime(selectedVenue.submitted_at, locale, tx)}</li>
                    <li>{tx('Latitude:')} {formatCoordinate(selectedVenue.latitude)}</li>
                    <li>{tx('Longitude:')} {formatCoordinate(selectedVenue.longitude)}</li>
                    <li>
                      {tx('Price range:')}
                      {' '}
                      {formatCurrencyVnd(selectedVenueMetadata.minPrice)} - {formatCurrencyVnd(selectedVenueMetadata.maxPrice)}
                    </li>
                    <li>{tx('Operating hours:')} {selectedVenueOperatingHours}</li>
                    <li>
                      Rating:
                      {' '}
                      {selectedVenueRatingSummary.total > 0
                        ? `${selectedVenueRatingSummary.average.toFixed(1)} / 5 (${selectedVenueRatingSummary.total} review${selectedVenueRatingSummary.total === 1 ? '' : 's'})`
                        : 'No ratings yet'}
                    </li>
                    <li>Gallery images: {selectedVenueGalleryImages.length || 0}</li>
                    <li>Business license: {selectedVenue.business_license_image_url ? 'Uploaded' : 'Missing'}</li>
                  </ul>

                  <div className="admin-form-field">
                    <label htmlFor="rejectionReason">Rejection Reason (Required for reject)</label>
                    <textarea
                      id="rejectionReason"
                      value={rejectReasons[selectedVenue.id] || ''}
                      onChange={(event) =>
                        setRejectReasons((currentReasons) => ({
                          ...currentReasons,
                          [selectedVenue.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Required before rejecting this post."
                    />
                  </div>

                  {(() => {
                    const isRejectReasonProvided = Boolean(String(rejectReasons[selectedVenue.id] || '').trim());

                    return (
                      <div className="admin-action-row">
                        {selectedVenueStatus !== 'approved' ? (
                          <button
                            type="button"
                            className="action-approve"
                            disabled={moderatingVenueId === selectedVenue.id}
                            onClick={() => handleModeration(selectedVenue.id, 'approve')}
                          >
                            {moderatingVenueId === selectedVenue.id ? tx('Updating...') : tx('Approve Post')}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="action-reject"
                          disabled={moderatingVenueId === selectedVenue.id || !isRejectReasonProvided}
                          onClick={() => handleModeration(selectedVenue.id, 'reject')}
                        >
                          Reject Post
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {activeDetailTab === 'introduction' ? (
                <div className="admin-extra-detail-block">
                  <strong>Venue introduction</strong>
                  {selectedVenueIntroduction ? (
                    <p className="admin-introduction-text">{selectedVenueIntroduction}</p>
                  ) : (
                    <p className="admin-empty-note">No introduction provided by merchant.</p>
                  )}

                  {selectedVenueWeeklySchedule.length ? (
                    <div className="admin-service-summary">
                      <strong>Weekly schedule</strong>
                      <ul className="admin-detail-meta admin-weekly-hours-list">
                        {selectedVenueWeeklySchedule.map((daySchedule) => (
                          <li key={`submission-weekly-${daySchedule}`}>{daySchedule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="admin-service-summary">
                    <strong>Services offered</strong>
                    {selectedVenueServiceNames.length ? (
                      <div className="admin-service-chip-list">
                        {selectedVenueServiceNames.map((serviceName) => (
                          <span key={serviceName} className="admin-service-chip">
                            {serviceName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-empty-note">No services selected by merchant.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {activeDetailTab === 'images' ? (
                <div className="admin-extra-detail-block">
                  <strong>Gallery</strong>
                  {selectedVenueGalleryImages.length ? (
                    <div className="admin-message-attachment-grid">
                      {selectedVenueGalleryImages.map((imageUrl, imageIndex) => {
                        const resolvedImageUrl = resolveAssetUrl(imageUrl);

                        if (!resolvedImageUrl) {
                          return null;
                        }

                        return (
                          <button
                            key={`${resolvedImageUrl}-${imageIndex}`}
                            type="button"
                            className="admin-license-image-wrap"
                            onClick={() => setExpandedImageUrl(resolvedImageUrl)}
                          >
                            <img
                              src={resolvedImageUrl}
                              alt={`${selectedVenue.title || selectedVenue.name} gallery ${imageIndex + 1}`}
                              className="admin-detail-image admin-detail-image-clickable"
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="admin-empty-note">No gallery images uploaded.</p>
                  )}

                  {selectedVenue.business_license_image_url ? (
                    <div className="admin-license-preview">
                      <p>Business license preview</p>
                      <button
                        type="button"
                        className="admin-license-image-wrap"
                        onClick={() => setExpandedImageUrl(resolveAssetUrl(selectedVenue.business_license_image_url))}
                      >
                        <img
                          src={resolveAssetUrl(selectedVenue.business_license_image_url)}
                          alt={`${selectedVenue.title || selectedVenue.name} license`}
                          className="admin-detail-image admin-detail-image-clickable"
                        />
                      </button>
                    </div>
                  ) : (
                    <p className="admin-empty-note">Business license not uploaded.</p>
                  )}
                </div>
              ) : null}

              {activeDetailTab === 'rating' ? (
                <div className="admin-extra-detail-block">
                  <div className="admin-review-toolbar">
                    <strong>
                      {selectedVenueRatingSummary.total > 0
                        ? `${selectedVenueRatingSummary.average.toFixed(1)} / 5 from ${selectedVenueRatingSummary.total} review${selectedVenueRatingSummary.total === 1 ? '' : 's'}`
                        : 'No ratings yet'}
                    </strong>

                    <select
                      id="selectedVenueReviewSort"
                      value={selectedVenueReviewSort}
                      onChange={(event) => setSelectedVenueReviewSort(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>

                  <div className="admin-review-root-form">
                    <h4>Comment on this venue</h4>
                    <input
                      type="text"
                      value={adminVenueCommentDraft.title}
                      placeholder="Title"
                      onChange={(event) =>
                        setAdminVenueCommentDraft((currentDraft) => ({
                          ...currentDraft,
                          title: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      rows={3}
                      value={adminVenueCommentDraft.comment}
                      placeholder="Write a comment..."
                      onChange={(event) =>
                        setAdminVenueCommentDraft((currentDraft) => ({
                          ...currentDraft,
                          comment: event.target.value,
                        }))
                      }
                    />
                    <label className="admin-review-reply-upload-label" htmlFor="admin-review-root-upload">
                      Upload images (max 3)
                    </label>
                    <input
                      id="admin-review-root-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="admin-review-reply-upload"
                      onChange={(event) => {
                        handleAdminVenueCommentMediaChange(Array.from(event.target.files || []));
                        event.target.value = '';
                      }}
                    />
                    {adminVenueCommentMediaFiles.length ? (
                      <div className="admin-review-reply-media-list">
                        {adminVenueCommentMediaFiles.map((file) => {
                          const fileId = `${file.name}-${file.lastModified}-${file.size}`;
                          return (
                            <div key={fileId} className="admin-review-reply-media-item">
                              <span>{file.name}</span>
                              <button
                                type="button"
                                className="admin-review-reply-media-remove"
                                onClick={() => handleRemoveAdminVenueCommentMedia(fileId)}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="action-secondary"
                      disabled={
                        submittingAdminVenueComment
                        || !String(adminVenueCommentDraft.comment || '').trim()
                      }
                      onClick={handlePostAdminVenueComment}
                    >
                      {submittingAdminVenueComment ? 'Posting...' : 'Post comment'}
                    </button>
                  </div>

                  {isLoadingSelectedVenueReviews ? <p className="admin-empty-note">Loading reviews...</p> : null}
                  {selectedVenueReviewsError ? <p className="admin-empty-note">{selectedVenueReviewsError}</p> : null}

                  {!isLoadingSelectedVenueReviews && !selectedVenueReviewsError ? (
                    selectedVenueReviews.length ? (
                      <div className="admin-review-list">
                        {selectedVenueReviews.map((review) => {
                          const reviewId = Number(review?.id);
                          const reviewAuthorName = String(review?.author_name || review?.authorName || 'Anonymous');
                          const reviewTitle = String(review?.title || '').trim();
                          const reviewComment = String(review?.comment || review?.content || '').trim();
                          const reviewReplies = Array.isArray(review?.replies) ? review.replies : [];
                          const reviewImageUrls = normalizeImageUrls(review?.image_urls || review?.imageUrls)
                            .map((imageUrl) => resolveAssetUrl(imageUrl))
                            .filter(Boolean);
                          const isReplyComposerOpenOnParent =
                            Number(activeAdminReplyTarget?.reviewId) === reviewId
                            && activeAdminReplyTarget?.replyId == null;

                          return (
                            <article key={review.id} className="admin-review-card admin-review-parent-card">
                              <div className="admin-review-card-header">
                                <strong>{reviewAuthorName}</strong>
                                <div className="admin-review-card-header-actions">
                                  <button
                                    type="button"
                                    className={`admin-review-comment-btn ${isReplyComposerOpenOnParent ? 'is-active' : ''}`.trim()}
                                    onClick={() => handleToggleAdminReviewReplyComposer(reviewId, reviewAuthorName)}
                                  >
                                    {isReplyComposerOpenOnParent ? 'Close' : 'Reply'}
                                  </button>
                                  {Number.isFinite(reviewId) ? (
                                    <button
                                      type="button"
                                      className="admin-review-delete-btn"
                                      disabled={deletingReviewId === reviewId}
                                      onClick={() => handleDeleteAdminReview(reviewId)}
                                    >
                                      {deletingReviewId === reviewId ? 'Deleting...' : 'Delete'}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <small>{formatDateTime(review?.updated_at || review?.created_at)}</small>

                              <div className="admin-review-parent-content">
                                {reviewTitle ? <p className="admin-review-title">{reviewTitle}</p> : null}
                                <p>{reviewComment || 'No written comment.'}</p>
                              </div>

                              {isReplyComposerOpenOnParent
                                ? renderAdminReviewReplyComposer(
                                  reviewId,
                                  reviewAuthorName,
                                  `Replying in ${reviewAuthorName}'s main thread`
                                )
                                : null}

                              {reviewImageUrls.length ? (
                                <div className="admin-message-attachment-grid">
                                  {reviewImageUrls.map((imageUrl, imageIndex) => (
                                    <button
                                      key={`${review.id}-image-${imageUrl}-${imageIndex}`}
                                      type="button"
                                      className="admin-license-image-wrap"
                                      onClick={() => setExpandedImageUrl(imageUrl)}
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`${reviewAuthorName} review ${imageIndex + 1}`}
                                        className="admin-detail-image admin-detail-image-clickable"
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              {reviewReplies.length ? (
                                <div className="admin-review-replies">
                                  <p className="admin-review-replies-label">
                                    Replies to <strong>{reviewAuthorName}</strong>
                                  </p>
                                  {reviewReplies.map((reply, replyIndex) => {
                                    const replyId = Number(reply?.id);
                                    const replyAuthorName = String(reply?.author_name || reply?.authorName || 'Anonymous');
                                    const replyTitle = String(reply?.title || '').trim();
                                    const replyContent = String(reply?.content || reply?.comment || '').trim();
                                    const isReplyComposerOpenOnChild =
                                      Number(activeAdminReplyTarget?.reviewId) === reviewId
                                      && Number(activeAdminReplyTarget?.replyId) === replyId;
                                    const replyIsAdmin =
                                      Boolean(reply?.is_admin || reply?.isAdmin)
                                      || String(reply?.author_role || reply?.authorRole || '').toLowerCase() === 'admin';
                                    const replyImageUrls = normalizeImageUrls(reply?.image_urls || reply?.imageUrls)
                                      .map((imageUrl) => resolveAssetUrl(imageUrl))
                                      .filter(Boolean);

                                    return (
                                      <div
                                        key={Number.isFinite(replyId)
                                          ? `${review.id}-reply-${replyId}`
                                          : `${review.id}-reply-index-${replyIndex}`}
                                        className={`admin-review-reply admin-review-child-card ${replyIsAdmin ? 'is-admin' : ''}`.trim()}
                                      >
                                        <div className="admin-review-reply-header">
                                          <strong>{replyIsAdmin ? `★ ${replyAuthorName}` : replyAuthorName}</strong>
                                          <div className="admin-review-reply-meta-badges">
                                            <span className="admin-review-reply-badge">Reply</span>
                                            {replyIsAdmin ? <span className="admin-review-admin-badge">Admin</span> : null}
                                            {Number.isFinite(replyId) ? (
                                              <button
                                                type="button"
                                                className={`admin-review-comment-btn ${isReplyComposerOpenOnChild ? 'is-active' : ''}`.trim()}
                                                onClick={() => handleToggleAdminReviewReplyComposer(reviewId, replyAuthorName, replyId)}
                                              >
                                                {isReplyComposerOpenOnChild ? 'Close' : 'Reply'}
                                              </button>
                                            ) : null}
                                            {Number.isFinite(replyId) ? (
                                              <button
                                                type="button"
                                                className="admin-review-delete-btn"
                                                disabled={deletingReplyId === replyId}
                                                onClick={() => handleDeleteAdminReviewReply(reviewId, replyId)}
                                              >
                                                {deletingReplyId === replyId ? 'Deleting...' : 'Delete'}
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>
                                        <small>{formatDateTime(reply?.updated_at || reply?.updatedAt || reply?.created_at || reply?.createdAt)}</small>
                                        {replyTitle ? <p className="admin-review-title">{replyTitle}</p> : null}
                                        <p className="admin-review-reply-content">{replyContent || 'No content.'}</p>

                                        {isReplyComposerOpenOnChild
                                          ? renderAdminReviewReplyComposer(
                                            reviewId,
                                            replyAuthorName,
                                            `Replying to ${replyAuthorName} under ${reviewAuthorName}'s thread`
                                          )
                                          : null}

                                        {replyImageUrls.length ? (
                                          <div className="admin-message-attachment-grid">
                                            {replyImageUrls.map((imageUrl, imageIndex) => (
                                              <button
                                                key={`${review.id}-reply-image-${imageUrl}-${imageIndex}`}
                                                type="button"
                                                className="admin-license-image-wrap"
                                                onClick={() => setExpandedImageUrl(imageUrl)}
                                              >
                                                <img
                                                  src={imageUrl}
                                                  alt={`${replyAuthorName} reply ${imageIndex + 1}`}
                                                  className="admin-detail-image admin-detail-image-clickable"
                                                />
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="admin-empty-note">No reviews found for this venue.</p>
                    )
                  ) : null}
                </div>
              ) : null}

            </div>
          )}
        </div>
      );
    }

    if (activeMode === 'ward') {
      return (
        <div className="admin-detail-panel">
          <header>
            <h3>{tx('Ward Naming')}</h3>
            <p>
              {selectedWardId
                ? 'Selected ward detected. You can add, update, or delete from this panel.'
                : 'No ward selected. Fill the form and click Add Ward.'}
            </p>
          </header>

          <div className="admin-form-stack">
            <div className="admin-form-field">
              <label htmlFor="wardName">Ward Name</label>
              <input
                id="wardName"
                name="name"
                value={wardForm.name}
                onChange={handleWardInputChange}
                placeholder="e.g. Hai Chau"
                required
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="wardDescription">Description</label>
              <textarea
                id="wardDescription"
                name="description"
                value={wardForm.description}
                onChange={handleWardInputChange}
                rows={2}
                placeholder="Short description for this ward"
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="boundaryJson">Boundary GeoJSON</label>
              <textarea
                id="boundaryJson"
                name="boundaryJson"
                value={wardForm.boundaryJson}
                onChange={handleWardInputChange}
                rows={8}
                placeholder={EMPTY_BOUNDARY_TEMPLATE}
                required
              />
            </div>

            <div className="admin-upload-wrap">
              <input type="file" accept=".json,.geojson,application/json" onChange={handleBoundaryFileLoad} />
            </div>

            {selectedWardId ? (
              <div className="admin-action-row">
                <button type="button" className="action-secondary" disabled={submittingWard} onClick={() => handleSaveWard('add')}>
                  {submittingWard ? 'Processing...' : 'Add Ward'}
                </button>

                <button type="button" className="action-primary" disabled={submittingWard} onClick={() => handleSaveWard('update')}>
                  {submittingWard ? 'Processing...' : 'Update Ward'}
                </button>

                <button type="button" className="action-danger" disabled={deletingWard} onClick={handleDeleteWard}>
                  {deletingWard ? 'Deleting...' : 'Delete Ward'}
                </button>
              </div>
            ) : (
              <div className="admin-action-row">
                <button type="button" className="action-primary" disabled={submittingWard} onClick={() => handleSaveWard('add')}>
                  {submittingWard ? 'Adding...' : 'Add Ward'}
                </button>
              </div>
            )}

            {selectedWardId ? (
              <button type="button" className="action-link" onClick={prepareAddWard}>
                Clear selection and create a new ward
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'service') {
      return (
        <div className="admin-detail-panel">
          <header>
            <h3>{tx('Services Offered - Merchant')}</h3>
            <p>Manage service options shown in the merchant registration form.</p>
          </header>

          <div className="admin-form-stack">
            <div className="admin-form-field">
              <label htmlFor="merchantServiceName">Service Name</label>
              <input
                id="merchantServiceName"
                value={serviceNameInput}
                onChange={(event) => setServiceNameInput(event.target.value)}
                placeholder="e.g. Family Room"
              />
            </div>

            <div className="admin-action-row">
              <button type="button" className="action-primary" disabled={submittingService} onClick={handleAddService}>
                {submittingService ? 'Processing...' : 'Add'}
              </button>

              <button
                type="button"
                className="action-secondary"
                disabled={!selectedServiceId || submittingService}
                onClick={handleUpdateService}
              >
                {submittingService ? 'Processing...' : 'Update'}
              </button>

              <button
                type="button"
                className="action-danger"
                disabled={!selectedServiceId || deletingServiceId === selectedServiceId}
                onClick={handleDeleteService}
              >
                {deletingServiceId === selectedServiceId ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            {selectedMerchantService ? (
              <p className="admin-inline-note">
                Selected service:
                <strong>{selectedMerchantService.name}</strong>
                <span>
                  ({serviceUsageCountById.get(Number(selectedMerchantService.id)) || 0} venue(s) use this option)
                </span>
              </p>
            ) : (
              <p className="admin-inline-note">Select a service from the left list to update or delete it.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="admin-detail-panel">
        <header>
          <h3>{tx('Place Categories')}</h3>
          <p>Manage main categories on the left, then add subcategories for the selected branch.</p>
        </header>

        <div className="admin-form-stack">
          <div className="admin-extra-detail-block">
            <strong>Main Category</strong>

            <div className="admin-category-grid">
              <div className="admin-form-field admin-form-field-icon">
                <label htmlFor="placeCategoryIcon">Icon</label>
                <input
                  id="placeCategoryIcon"
                  value={categoryIconInput}
                  onChange={(event) => setCategoryIconInput(event.target.value)}
                  placeholder="Type an emoji with Windows + ."
                  maxLength={24}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="placeCategoryName">Main Category Name</label>
                <input
                  id="placeCategoryName"
                  value={categoryNameInput}
                  onChange={(event) => setCategoryNameInput(event.target.value)}
                  placeholder="e.g. Entertainment"
                />
              </div>
            </div>

            <div className="admin-action-row">
              <button type="button" className="action-primary" disabled={submittingCategory} onClick={handleAddCategory}>
                {submittingCategory ? 'Processing...' : 'Add'}
              </button>

              <button
                type="button"
                className="action-secondary"
                disabled={!selectedCategoryId || submittingCategory}
                onClick={handleUpdateCategory}
              >
                {submittingCategory ? 'Processing...' : 'Update'}
              </button>

              <button
                type="button"
                className="action-danger"
                disabled={!selectedCategoryId || deletingCategoryId === selectedCategoryId}
                onClick={handleDeleteCategory}
              >
                {deletingCategoryId === selectedCategoryId ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            {selectedCategory ? (
              <p className="admin-inline-note">
                Selected main category:
                <span className="category-icon-dot" aria-hidden="true">
                  {normalizeCategoryIcon(selectedCategory.icon)}
                </span>
                {selectedCategory.name}
                <span>{selectedCategoryChildren.length} subcategories</span>
              </p>
            ) : (
              <p className="admin-inline-note">Create a new main category or select one from the left panel.</p>
            )}
          </div>

          <div className="admin-extra-detail-block">
            <strong>Subcategories</strong>
            <p className="admin-empty-note">
              {selectedCategory
                ? `Every venue still stores the final subcategory. Main category "${selectedCategory.name}" is only used for grouping and filtering.`
                : 'Select a main category first to create or manage its subcategories.'}
            </p>

            <div className="admin-category-grid">
              <div className="admin-form-field admin-form-field-icon">
                <label htmlFor="placeSubcategoryIcon">Icon</label>
                <input
                  id="placeSubcategoryIcon"
                  value={subcategoryIconInput}
                  onChange={(event) => setSubcategoryIconInput(event.target.value)}
                  placeholder="Type an emoji with Windows + ."
                  maxLength={24}
                  disabled={!selectedCategory}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="placeSubcategoryName">Subcategory Name</label>
                <input
                  id="placeSubcategoryName"
                  value={subcategoryNameInput}
                  onChange={(event) => setSubcategoryNameInput(event.target.value)}
                  placeholder="e.g. Karaoke"
                  disabled={!selectedCategory}
                />
              </div>
            </div>

            <div className="admin-action-row">
              <button
                type="button"
                className="action-primary"
                disabled={!selectedCategory || submittingCategory}
                onClick={handleAddSubcategory}
              >
                {submittingCategory ? 'Processing...' : 'Add'}
              </button>

              <button
                type="button"
                className="action-secondary"
                disabled={!selectedSubcategory || submittingCategory}
                onClick={handleUpdateSubcategory}
              >
                {submittingCategory ? 'Processing...' : 'Update'}
              </button>

              <button
                type="button"
                className="action-danger"
                disabled={!selectedSubcategory || deletingCategoryId === selectedSubcategoryId}
                onClick={handleDeleteSubcategory}
              >
                {deletingCategoryId === selectedSubcategoryId ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            <div className="admin-subcategory-list">
              {selectedCategoryChildren.map((subcategory) => (
                <button
                  key={subcategory.id}
                  type="button"
                  className={`admin-subcategory-item ${Number(selectedSubcategoryId) === Number(subcategory.id) ? 'is-active' : ''}`.trim()}
                  onClick={() => loadSubcategoryToEditor(subcategory)}
                >
                  <strong>
                    <span className="category-icon-dot" aria-hidden="true">
                      {normalizeCategoryIcon(subcategory.icon)}
                    </span>
                    {subcategory.name}
                  </strong>
                  <span>{categoryUsageCountById.get(Number(subcategory.id)) || 0} venue(s) use this subcategory</span>
                </button>
              ))}

              {selectedCategory && !selectedCategoryChildren.length ? (
                <p className="admin-empty-note">No subcategories under this main category yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-map-page">
      <SectionCard
        className="admin-map-section-card"
        eyebrow={tx('Admin Map Management')}
        title={tx('Map Moderation Workspace')}
        description={tx('Manage pending posts, ward boundaries, place categories, and merchant services without affecting other modules.')}
      >
        {operationMessage ? <div className="admin-map-message success">{operationMessage}</div> : null}
        {loadWarning ? <div className="admin-map-message warning">{loadWarning}</div> : null}
        {error ? <div className="admin-map-message error">{error}</div> : null}

        <div className="admin-mode-tabs" role="tablist" aria-label={tx('Admin map modes')}>
          {PAGE_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`admin-mode-tab ${activeMode === mode.value ? 'is-active' : ''}`.trim()}
              onClick={() => handleModeChange(mode.value)}
            >
              <strong>{tx(mode.label)}</strong>
              <span>{tx(mode.helper)}</span>
            </button>
          ))}
        </div>

        <p className="admin-mode-helper">{activeModeMeta?.helper ? tx(activeModeMeta.helper) : ''}</p>

        <div className="admin-workspace-grid">
          <aside className="admin-workspace-panel left">{renderLeftPanel()}</aside>

          <section className="admin-map-canvas">
            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
              <MapViewportController center={mapCenter} zoom={mapZoom} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              />

              {wards.map((ward) => {
                const polygonBoundary = toPolygonBoundaryFeatureCollection(ward.boundary);

                if (!polygonBoundary) {
                  return null;
                }

                return (
                  <GeoJSON
                    key={`${ward.ward_id}-${ward.updated_at || ward.created_at || ''}`}
                    data={polygonBoundary}
                    style={{
                      color: selectedWardId === ward.ward_id ? '#f25f29' : '#155e63',
                      weight: selectedWardId === ward.ward_id ? 3 : 2,
                      fillOpacity: selectedWardId === ward.ward_id ? 0.24 : 0.08,
                    }}
                    eventHandlers={
                      activeMode === 'ward'
                        ? {
                            click: () => loadWardToEditor(ward),
                          }
                        : undefined
                    }
                  >
                    <Tooltip sticky>
                      <span>{ward.name}</span>
                    </Tooltip>
                  </GeoJSON>
                );
              })}

              {activeMode === 'pending' && pendingQueueView === 'updates' ? (
                <>
                  {pendingLocationUpdateRequests
                    .map((request) => ({
                      request,
                      proposedSnapshot: normalizeVenueUpdateSnapshot(request.proposed_snapshot),
                    }))
                    .filter(
                      ({ proposedSnapshot }) =>
                        Number.isFinite(Number(proposedSnapshot.latitude)) &&
                        Number.isFinite(Number(proposedSnapshot.longitude))
                    )
                    .map(({ request, proposedSnapshot }) => (
                      <Marker
                        key={`update-request-new-${request.id}`}
                        position={[Number(proposedSnapshot.latitude), Number(proposedSnapshot.longitude)]}
                        icon={updateRequestNewIcon}
                        eventHandlers={{
                          click: () => handleOpenUpdateRequestDetails(request.id),
                        }}
                      >
                        <Popup>
                          <div className="admin-map-popup">
                            {proposedSnapshot.coverImageUrl ? (
                              <img
                                src={proposedSnapshot.coverImageUrl}
                                alt={request.venue_title || request.venue_name || `Venue #${request.venue_id}`}
                                className="admin-map-popup-image"
                              />
                            ) : (
                              <div className="admin-map-popup-image-placeholder">No proposed cover image</div>
                            )}

                            <h3>{request.venue_title || request.venue_name || `Venue #${request.venue_id}`}</h3>
                            <p>{proposedSnapshot.address || request.venue_address || 'Address pending'}</p>
                            <ul>
                              <li>{tx('Queue:')} {tx('Location Updates')}</li>
                              <li>Marker: New Location (Dark Orange)</li>
                              <li>Ward: {proposedSnapshot.wardId || 'Not detected'}</li>
                              <li>Status: Pending</li>
                            </ul>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                  {selectedUpdateRequest &&
                  Number.isFinite(Number(selectedUpdateOldSnapshot.latitude)) &&
                  Number.isFinite(Number(selectedUpdateOldSnapshot.longitude)) ? (
                    <Marker
                      key={`update-request-old-${selectedUpdateRequest.id}`}
                      position={[Number(selectedUpdateOldSnapshot.latitude), Number(selectedUpdateOldSnapshot.longitude)]}
                      icon={updateRequestOldIcon}
                    >
                      <Popup>
                        <div className="admin-map-popup">
                          <h3>{selectedUpdateRequest.venue_title || selectedUpdateRequest.venue_name || `Venue #${selectedUpdateRequest.venue_id}`}</h3>
                          <p>{selectedUpdateOldSnapshot.address || 'Address pending'}</p>
                          <ul>
                            <li>{tx('Queue:')} {tx('Location Updates')}</li>
                            <li>Marker: Old Location (Teal)</li>
                            <li>Ward: {selectedUpdateOldSnapshot.wardId || 'Not detected'}</li>
                            <li>Status: Current Live Data</li>
                          </ul>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null}
                </>
              ) : (activeMode === 'pending' ? pendingFilteredVenues : visibleVenues)
                    .filter((venue) => Number.isFinite(Number(venue.latitude)) && Number.isFinite(Number(venue.longitude)))
                    .map((venue) => (
                      <Marker
                        key={venue.id}
                        position={[Number(venue.latitude), Number(venue.longitude)]}
                        icon={resolveMarkerIcon(venue)}
                        eventHandlers={
                          activeMode === 'pending'
                            ? {
                                click: () => handleOpenVenueDetails(venue.id),
                              }
                            : undefined
                        }
                      >
                        <Popup>
                          <div className="admin-map-popup">
                            {venue.cover_image_url ? (
                              <img src={venue.cover_image_url} alt={venue.name} className="admin-map-popup-image" />
                            ) : (
                              <div className="admin-map-popup-image-placeholder">No cover image</div>
                            )}

                            <h3>{venue.title || venue.name}</h3>
                            <p>{venue.address || 'Address pending'}</p>
                            <ul>
                              <li>Ward: {venue.ward_name || venue.ward_id || 'Not detected'}</li>
                              <li>Category: {formatVenueCategoryLabel(venue, placeCategoryTree)}</li>
                              <li>Status: {statusLabel(venue.status)}</li>
                              <li>Phone: {venue.phone || 'Not provided'}</li>
                            </ul>
                            {venue.description ? <p className="admin-map-popup-description">{venue.description}</p> : null}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
            </MapContainer>

            {activeMode === 'pending' && pendingQueueView === 'submissions' ? (
              <div className="admin-pending-map-controls">
                <button
                  type="button"
                  className="admin-pending-filter-toggle"
                  onClick={() => setIsPendingFilterPanelOpen((current) => !current)}
                >
                  {tx('Filters')} {pendingActiveFilterCount ? `(${pendingActiveFilterCount})` : ''}
                </button>
              </div>
            ) : null}

            {activeMode === 'pending' && pendingQueueView === 'submissions' && isPendingFilterPanelOpen ? (
              <section className="admin-pending-filter-panel" role="region" aria-label={tx('Pending map filters')}>
                <header>
                  <h3>{tx('Map filters')}</h3>
                  <button
                    type="button"
                    onClick={() => setIsPendingFilterPanelOpen(false)}
                    aria-label={tx('Close pending filters')}
                  >
                    ×
                  </button>
                </header>

                <p>{tx('Choose Place Categories, Ward Naming, and Services Offered, then search by place name.')}</p>

                <label className="admin-pending-search-field">
                  <span>{tx('Search keyword')}</span>
                  <input
                    type="text"
                    value={pendingSearchInput}
                    placeholder={tx('Place name (supports Vietnamese with/without accents)')}
                    onChange={(event) => setPendingSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyPendingFilters();
                      }
                    }}
                  />
                </label>

                <div className="admin-pending-filter-row">
                  <div className="admin-pending-filter-group">
                    <h4>{tx('Place Categories')}</h4>
                    <div className="admin-pending-filter-list">
                      {rootPlaceCategories.map((category) => {
                        const categoryId = Number(category.id);
                        const childCategories = childCategoriesByParentId.get(categoryId) || [];
                        const isChecked = selectedPendingCategoryIds.includes(categoryId);
                        const isExpanded = expandedPendingCategoryRootIds.includes(categoryId);

                        return (
                          <div key={`pending-category-${categoryId}`} className="admin-category-filter-branch">
                            <div className="admin-category-filter-parent">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePendingCategoryBranchSelection(categoryId)}
                                />
                                <span>{normalizeCategoryIcon(category.icon)} {category.name}</span>
                              </label>

                              {childCategories.length ? (
                                <button
                                  type="button"
                                  className="admin-category-filter-toggle"
                                  onClick={() => togglePendingCategoryBranchExpansion(categoryId)}
                                  aria-label={isExpanded ? tx('Collapse subcategories') : tx('Expand subcategories')}
                                >
                                  {isExpanded ? '−' : '+'}
                                </button>
                              ) : null}
                            </div>

                            {childCategories.length && isExpanded ? (
                              <div className="admin-category-filter-children">
                                {childCategories.map((subcategory) => {
                                  const subcategoryId = Number(subcategory.id);
                                  const subcategoryChecked = selectedPendingCategoryIds.includes(subcategoryId);

                                  return (
                                    <label key={`pending-subcategory-${subcategoryId}`}>
                                      <input
                                        type="checkbox"
                                        checked={subcategoryChecked}
                                        onChange={() => togglePendingSelection(setSelectedPendingCategoryIds)(subcategoryId)}
                                      />
                                      <span>{normalizeCategoryIcon(subcategory.icon)} {subcategory.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-pending-filter-group">
                    <h4>{tx('Ward Naming')}</h4>
                    <div className="admin-pending-filter-list">
                      {wards.map((ward) => {
                        const wardId = String(ward.ward_id);
                        const checked = selectedPendingWardIds.includes(wardId);

                        return (
                          <label key={`pending-ward-${wardId}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePendingSelection(setSelectedPendingWardIds)(wardId)}
                            />
                            <span>{ward.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-pending-filter-group">
                    <h4>{tx('Services Offered - Merchant')}</h4>
                    <div className="admin-pending-filter-list">
                      {merchantServices.map((service) => {
                        const serviceId = Number(service.id);
                        const checked = selectedPendingServiceIds.includes(serviceId);

                        return (
                          <label key={`pending-service-${serviceId}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePendingSelection(setSelectedPendingServiceIds)(serviceId)}
                            />
                            <span>{service.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="admin-pending-filter-actions">
                  <button type="button" className="apply" onClick={applyPendingFilters}>{tx('Search')}</button>
                  <button type="button" className="clear" onClick={clearPendingFilters}>{tx('Clear')}</button>
                </div>
              </section>
            ) : null}

            {loading ? <div className="admin-map-overlay">{tx('Loading map management data...')}</div> : null}
          </section>

          <aside className="admin-workspace-panel right">{renderRightPanel()}</aside>
        </div>

        {expandedImageUrl ? (
          <div className="admin-image-lightbox" role="dialog" aria-modal="true" onClick={() => setExpandedImageUrl('')}>
            <button
              type="button"
              className="admin-lightbox-close"
              onClick={() => setExpandedImageUrl('')}
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={expandedImageUrl}
              alt="Expanded venue"
              className="admin-lightbox-image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export default AdminBoundaryPage;

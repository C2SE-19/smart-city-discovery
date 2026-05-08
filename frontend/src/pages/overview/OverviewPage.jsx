import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import axios from 'axios';
import { getApiBaseUrl } from '../../services/api/client';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import { fetchMerchantServices } from '../../services/api/merchantServicesApi';
import { fetchWards } from '../../services/api/wardsApi';
import { fetchVenues } from '../../services/api/venuesApi';
import { searchVenuesByImage } from '../../services/api/imageSearchApi';
import {
  fetchForYouRecommendations,
  refineForYouRecommendations,
  fetchUserPreferences
} from '../../services/api/userPreferencesApi';
import { fetchCurrentWeather } from '../../services/api/weatherApi';
import {
  fetchTrendingVenues,
} from '../../services/api/adPackagesApi';
import OverviewCityMapCard from '../../components/map/OverviewCityMapCard';
import heroFoodImage from '../../assets/images/anh1.png';
import UserPreferenceWizard from '../../components/preferences/UserPreferenceWizard';
import {
  buildPlaceCategoryTree,
  normalizeCategoryIcon
} from '../../utils/placeCategoryTree';
import './OverviewPage.css';

const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80';

function renderHighlightedTitle(title) {
  const match = String(title || '').match(/^(.*)<span>(.*)<\/span>(.*)$/);

  if (!match) {
    return <h1>{title}</h1>;
  }

  return (
    <h1>
      {match[1]}
      <span>{match[2]}</span>
      {match[3]}
    </h1>
  );
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

function hasVietnameseToneMarks(value) {
  return /[\u0300\u0301\u0303\u0309\u0323]/.test(String(value || '').normalize('NFD'));
}

function normalizeVietnameseToneInsensitive(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '')
    .toLowerCase()
    .trim();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for resizing.'));
    img.src = dataUrl;
  });
}

async function createCompressedImageDataUrl(file, maxWidth = 1400, maxHeight = 1400, quality = 0.84) {
  const originalDataUrl = await readFileAsDataUrl(file);

  if (typeof document === 'undefined') {
    return originalDataUrl;
  }

  const image = await loadImageElement(originalDataUrl);
  const width = Number(image.naturalWidth || image.width || 0);
  const height = Number(image.naturalHeight || image.height || 0);

  if (!width || !height) {
    return originalDataUrl;
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  if (scale >= 1) {
    return originalDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return originalDataUrl;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function getVenueImage(venue) {
  return (
    venue.cover_image_url ||
    venue.coverImageUrl ||
    venue.image ||
    FALLBACK_VENUE_IMAGE
  );
}

function getVenueCategoryId(venue) {
  const normalized = Number(venue.category_id ?? venue.categoryId);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function toFavoriteVenuePayload(venue) {
  return {
    id: venue.id,
    name: venue.name || venue.title || 'Untitled venue',
    image: getVenueImage(venue),
    price: 'N/A',
    description: venue.description || venue.address || ''
  };
}

const DEFAULT_CITY_COORDINATES = {
  latitude: 16.0544,
  longitude: 108.2022
};

const DEFAULT_CITY_LABEL = 'Da Nang, Vietnam';

const WEATHER_EMOJI_BY_MAIN = {
  clear: '☀️',
  clouds: '☁️',
  rain: '🌧️',
  drizzle: '🌦️',
  thunderstorm: '⛈️',
  mist: '🌫️',
  fog: '🌫️',
  haze: '🌫️',
  snow: '❄️'
};

function resolveWeatherEmoji(conditionMain) {
  const weatherKey = String(conditionMain || '').trim().toLowerCase();
  return WEATHER_EMOJI_BY_MAIN[weatherKey] || '🌡️';
}

function formatDistanceKm(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  const distanceKm = Number(value);
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 'N/A';
  }

  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

function parseCoordinateValue(value) {
  const normalizedValue = typeof value === 'string'
    ? value.trim().replace(',', '.')
    : value;
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValidCoordinates(coordinates) {
  const latitude = Number(coordinates?.latitude);
  const longitude = Number(coordinates?.longitude);

  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function resolveVenueCoordinatesForDistance(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const locationMetadata = metadata?.location && typeof metadata.location === 'object'
    ? metadata.location
    : {};

  const latitudeCandidates = [
    venue?.latitude,
    metadata?.latitude,
    metadata?.lat,
    locationMetadata?.latitude,
    locationMetadata?.lat,
  ];
  const longitudeCandidates = [
    venue?.longitude,
    metadata?.longitude,
    metadata?.lng,
    metadata?.lon,
    locationMetadata?.longitude,
    locationMetadata?.lng,
    locationMetadata?.lon,
  ];

  const latitude = latitudeCandidates
    .map((candidate) => parseCoordinateValue(candidate))
    .find((candidate) => candidate !== null);
  const longitude = longitudeCandidates
    .map((candidate) => parseCoordinateValue(candidate))
    .find((candidate) => candidate !== null);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { latitude: null, longitude: null };
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
}

function computeDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const lat1 = Number(fromLatitude);
  const lon1 = Number(fromLongitude);
  const lat2 = Number(toLatitude);
  const lon2 = Number(toLongitude);

  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function resolveBrowserCoordinates({
  fallbackCoordinates = DEFAULT_CITY_COORDINATES,
  timeoutMs = 8000,
  maximumAgeMs = 60000,
} = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(fallbackCoordinates);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          resolve({ latitude, longitude });
          return;
        }

        resolve(fallbackCoordinates);
      },
      () => resolve(fallbackCoordinates),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
      }
    );
  });
}

function formatLocationClockByOffset(offsetSeconds) {
  const parsedOffset = Number(offsetSeconds);
  const resolvedOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const utcShiftedDate = new Date(Date.now() + resolvedOffset * 1000);

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(utcShiftedDate);
}

function createTrendClickToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `trend-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const CONTINUOUS_SLIDER_SECTION_IDS = new Set(['trending', 'for-you']);

function buildLocalFallbackWeather() {
  return {
    city: 'Da Nang',
    country: 'VN',
    conditionMain: 'Clear',
    conditionDescription: 'sunny in Da Nang',
    temperatureC: 31,
    timezoneOffsetSeconds: 7 * 3600
  };
}

const WEEK_DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
];

function resolveWeeklySchedule(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const canonicalSource =
    metadata.weeklySchedule && typeof metadata.weeklySchedule === 'object' && !Array.isArray(metadata.weeklySchedule)
      ? metadata.weeklySchedule
      : null;

  const fallbackStart = String(metadata.startTime || '').trim();
  const fallbackEnd = String(metadata.endTime || '').trim();
  const hasFallbackRange =
    /^\d{2}:\d{2}$/.test(fallbackStart) && /^\d{2}:\d{2}$/.test(fallbackEnd) && fallbackStart < fallbackEnd;

  if (!canonicalSource && !hasFallbackRange) {
    return [];
  }

  return WEEK_DAYS.map((day) => {
    const item = canonicalSource?.[day.key] || {};
    const start = String(item.start || '').trim() || (hasFallbackRange ? fallbackStart : '');
    const end = String(item.end || '').trim() || (hasFallbackRange ? fallbackEnd : '');
    const off = Boolean(item.off) || start === 'OFF' || end === 'OFF';

    return {
      key: day.key,
      open: off ? 'OFF' : start || 'N/A',
      close: off ? 'OFF' : end || 'N/A',
      off
    };
  });
}

function resolveTodaySchedule(weeklySchedule) {
  if (!Array.isArray(weeklySchedule) || !weeklySchedule.length) {
    return null;
  }

  const dayKeyByIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayKey = dayKeyByIndex[new Date().getDay()] || 'monday';
  return weeklySchedule.find((item) => item.key === todayKey) || null;
}

function toMinutesFromHHmm(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || '').trim())) {
    return null;
  }

  const [hoursPart, minutesPart] = String(value).split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function resolveVenueOpenState(venue) {
  const weeklySchedule = resolveWeeklySchedule(venue);
  const todaySchedule = resolveTodaySchedule(weeklySchedule);

  if (!todaySchedule || todaySchedule.off || todaySchedule.open === 'OFF' || todaySchedule.close === 'OFF') {
    return { isOpen: false, timeRange: 'N/A - N/A' };
  }

  const start = todaySchedule.open || 'N/A';
  const end = todaySchedule.close || 'N/A';
  const startMinutes = toMinutesFromHHmm(start);
  const endMinutes = toMinutesFromHHmm(end);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isOpen =
    startMinutes !== null &&
    endMinutes !== null &&
    startMinutes < endMinutes &&
    nowMinutes >= startMinutes &&
    nowMinutes < endMinutes;

  return { isOpen, timeRange: `${start} - ${end}` };
}

function resolveVenuePriceRange(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const minPrice = Number(metadata.minPrice ?? metadata.min_price);
  const maxPrice = Number(metadata.maxPrice ?? metadata.max_price);

  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > 0 && maxPrice >= minPrice) {
    return `$ ${minPrice.toLocaleString('vi-VN')}đ - ${maxPrice.toLocaleString('vi-VN')}đ`;
  }

  const directCandidates = [venue?.price, venue?.price_range, metadata.price, metadata.priceRange]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return directCandidates[0] ? `$ ${directCandidates[0]}` : '$ N/A';
}

function FilterGroup({ title, options, selectedValues, optionValue, optionLabel, onToggle }) {
  return (
    <section className="overview-filter-group">
      <header>
        <h3>{title}</h3>
      </header>

      {!options.length ? (
        <p className="overview-empty-copy">No options available.</p>
      ) : (
        <div className="overview-filter-options">
          {options.map((option) => {
            const value = optionValue(option);
            const checked = selectedValues.includes(value);

            return (
              <label key={`${title}-${String(value)}`} className="overview-filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(value)}
                />
                <span>{optionLabel(option)}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OverviewCategoryFilterGroup({
  rootCategories,
  childCategoriesByParentId,
  selectedValues,
  expandedRootIds,
  onToggleBranch,
  onToggleChild,
}) {
  return (
    <section className="overview-filter-group">
      <header>
        <h3>Place Categories</h3>
      </header>

      {!rootCategories.length ? (
        <p className="overview-empty-copy">No options available.</p>
      ) : (
        <div className="overview-filter-options">
          {rootCategories.map((category) => {
            const categoryId = Number(category.id);
            const childCategories = childCategoriesByParentId.get(categoryId) || [];
            const isExpanded = expandedRootIds.includes(categoryId);
            const isChecked = selectedValues.includes(categoryId);

            return (
              <div key={`overview-category-${categoryId}`} className="overview-category-branch">
                <label className="overview-filter-option overview-filter-option-parent">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleBranch(categoryId)}
                  />
                  <span className="overview-category-option-label">
                    <b>{normalizeCategoryIcon(category.icon)}</b>
                    <span>{category.name}</span>
                  </span>
                </label>

                {childCategories.length && isExpanded ? (
                  <div className="overview-category-children">
                    {childCategories.map((subcategory) => {
                      const subcategoryId = Number(subcategory.id);
                      const checked = selectedValues.includes(subcategoryId);

                      return (
                        <label key={`overview-subcategory-${subcategoryId}`} className="overview-filter-option overview-filter-option-child">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleChild(subcategoryId)}
                          />
                          <span className="overview-category-option-label">
                            <b>{normalizeCategoryIcon(subcategory.icon)}</b>
                            <span>{subcategory.name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VenueCard({ venue, isFavorite, onToggleFavorite, onExplore, showDistance = false, userCoordinates = null }) {
  const venueName = venue.name || venue.title || 'Untitled venue';
  const venueAddress = venue.address || 'Address not available';
  const wardName = venue.ward_name || venue.wardName;
  const featuredPromotionLabel = venue?.featuredPromotion?.isHot
    ? String(venue?.featuredPromotion?.label || 'HOT').trim() || 'HOT'
    : '';
  const { isOpen, timeRange } = resolveVenueOpenState(venue);
  const priceRange = resolveVenuePriceRange(venue);
  const venueCoordinates = resolveVenueCoordinatesForDistance(venue);
  const distanceFromClientCoordinates = hasValidCoordinates(userCoordinates)
    ? computeDistanceKm(
      userCoordinates.latitude,
      userCoordinates.longitude,
      venueCoordinates.latitude,
      venueCoordinates.longitude
    )
    : null;
  const fallbackDistanceKm = Number(venue.distanceKm);
  const resolvedDistanceKm = Number.isFinite(distanceFromClientCoordinates)
    ? Number(distanceFromClientCoordinates.toFixed(3))
    : (Number.isFinite(fallbackDistanceKm) ? fallbackDistanceKm : null);
  const distanceLabel = formatDistanceKm(resolvedDistanceKm);

  return (
    <article
      className="overview-dynamic-card"
      onClick={() => onExplore(venue)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onExplore(venue);
        }
      }}
    >
      <div className="overview-dynamic-media">
        {featuredPromotionLabel ? (
          <span className="overview-featured-hot-badge">{featuredPromotionLabel}</span>
        ) : null}
        <button
          type="button"
          className="overview-dynamic-media-link"
          onClick={(event) => {
            event.stopPropagation();
            onExplore(venue);
          }}
          aria-label={`Open ${venueName} on Discovery`}
        >
          <img src={getVenueImage(venue)} alt={venueName} loading="lazy" />
        </button>

        <button
          type="button"
          className={`overview-favorite ${isFavorite ? 'is-active' : ''}`}
          aria-label={isFavorite ? `Unsave ${venueName}` : `Save ${venueName}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(toFavoriteVenuePayload(venue), 'place');
          }}
        />
      </div>

      <div className="overview-dynamic-body">
        <h4>
          <button
            type="button"
            className="overview-dynamic-title-link"
            onClick={(event) => {
              event.stopPropagation();
              onExplore(venue);
            }}
          >
            {venueName}
          </button>
        </h4>
        <p className="overview-dynamic-address">📍 {venueAddress}</p>
        <p className="overview-dynamic-ward">🗺 {wardName || 'N/A'}</p>

        <div className="overview-dynamic-meta">
          <p className="overview-meta-item">
            <strong className={`overview-open-status ${isOpen ? 'is-open' : 'is-closed'}`}>
              {isOpen ? 'Open now' : 'Closed now'}
            </strong>
            <span>{timeRange}</span>
            <span className="overview-opening-alert">!</span>
          </p>

          {showDistance ? (
            <p className="overview-meta-item">
              <strong>Distance</strong>
              <span>{distanceLabel}</span>
            </p>
          ) : null}

          <p className="overview-meta-item overview-meta-price">
            <span>{priceRange}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { token, user } = useAuth();
  const isAuthenticated = Boolean(token && user);
  const t = translations[language] || translations.en;
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [expandedCategoryRootIds, setExpandedCategoryRootIds] = useState([]);
  const [selectedWardIds, setSelectedWardIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [appliedCategoryIds, setAppliedCategoryIds] = useState([]);
  const [appliedWardIds, setAppliedWardIds] = useState([]);
  const [appliedServiceIds, setAppliedServiceIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wards, setWards] = useState([]);
  const [services, setServices] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [filterError, setFilterError] = useState('');
  const [venueError, setVenueError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [locationClock, setLocationClock] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageSearchTarget, setImageSearchTarget] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchVenues, setImageSearchVenues] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [userPreference, setUserPreference] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [showPreferenceWizard, setShowPreferenceWizard] = useState(false);
  const [forYouVenues, setForYouVenues] = useState([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouError, setForYouError] = useState('');
  const [trendingVenues, setTrendingVenues] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState('');
  const [aiSuggestMode, setAiSuggestMode] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestError, setAiSuggestError] = useState('');
  const [aiSuggestedVenues, setAiSuggestedVenues] = useState([]);
  const [aiBaseVenues, setAiBaseVenues] = useState([]);
  const [aiVisibleCount, setAiVisibleCount] = useState(8);
  const [aiContext, setAiContext] = useState(null);
  const [aiRefineInput, setAiRefineInput] = useState('');
  const [aiRefineLoading, setAiRefineLoading] = useState(false);
  const [aiRefineError, setAiRefineError] = useState('');
  const [aiRefineMeta, setAiRefineMeta] = useState(null);
  const [geoCoordinates, setGeoCoordinates] = useState({ latitude: null, longitude: null });
  const [sliderPager, setSliderPager] = useState({});
  const sliderRefs = useRef(new Map());
  const sliderRefCallbackRefs = useRef(new Map());
  const sliderCleanupRefs = useRef(new Map());
  const sliderHoverRefs = useRef(new Map());
  const sliderLoopWidthRefs = useRef(new Map());
  const sliderAnimationFrameRefs = useRef(new Map());
  const sliderAnimStateRefs = useRef(new Map());
  const sliderManualPauseUntilRefs = useRef(new Map());
  const searchInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [showCameraOverlay, setShowCameraOverlay] = useState(false);
  const placeCategoryTree = useMemo(() => buildPlaceCategoryTree(categories), [categories]);
  const rootPlaceCategories = placeCategoryTree.rootCategories;
  const childCategoriesByParentId = placeCategoryTree.childrenByParentId;

  // Carousel state for hero float images
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselImages = useMemo(() => [
    {
      src: 'data:image/jpeg;base64,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',
      alt: 'Ba Na Hills'
    },
    {
      src: 'data:image/jpeg;base64,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',
      alt: 'My Khe Beach'
    },
    {
      src: 'data:image/jpeg;base64,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',
      alt: 'Marble Mountains'
    },
    {
      src: 'data:image/jpeg;base64,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',
      alt: 'Hoi An Ancient Town'
    }
  ], []);

  const closeImageModal = () => {
    setShowImageSearch(false);
    setImageSearchTarget('');
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    setImageSearchLoading(false);
    stopCamera();
    setShowCameraOverlay(false);
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const openImageModal = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search || ''}` } });
      return;
    }

    setShowImageSearch(true);
    setImageSearchTarget('');
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    setImageSearchLoading(false);
  };

  const handleCarouselPrev = () => {
    setCarouselIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  const handleCarouselNext = () => {
    setCarouselIndex((prev) => (prev + 1) % carouselImages.length);
  };

  const handleMerchantButtonClick = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search || ''}` } });
      return;
    }

    navigate('/merchant');
  };

  const apiUrl = useMemo(() => getApiBaseUrl(), []);

  const venueParams = useMemo(() => {
    const params = { status: 'approved' };

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
  }, [appliedCategoryIds, appliedWardIds, appliedServiceIds]);

  const normalizedSubmittedSearch = useMemo(
    () => normalizeSearchText(submittedSearch),
    [submittedSearch]
  );
  const exactSubmittedSearch = useMemo(
    () => normalizeExactSearchText(submittedSearch),
    [submittedSearch]
  );
  const toneInsensitiveSubmittedSearch = useMemo(
    () => normalizeVietnameseToneInsensitive(submittedSearch),
    [submittedSearch]
  );
  const submittedSearchHasTone = useMemo(
    () => hasVietnameseToneMarks(submittedSearch),
    [submittedSearch]
  );

  const displayedVenues = useMemo(() => {
    if (searchTriggered && imageSearchVenues.length > 0) {
      return imageSearchVenues;
    }

    if (!normalizedSubmittedSearch) {
      return venues;
    }

    if (submittedSearchHasTone) {
      return venues.filter((venue) => {
        const venueName = venue.name || venue.title || '';
        return normalizeExactSearchText(venueName).includes(exactSubmittedSearch);
      });
    }

    return venues.filter((venue) => {
      const venueName = venue.name || venue.title || '';
      const exactName = normalizeExactSearchText(venueName);
      const toneInsensitiveName = normalizeVietnameseToneInsensitive(venueName);
      const asciiName = normalizeSearchText(venueName);

      return (
        exactName.includes(exactSubmittedSearch)
        || toneInsensitiveName.includes(toneInsensitiveSubmittedSearch)
        || asciiName.includes(normalizedSubmittedSearch)
      );
    });
  }, [
    searchTriggered,
    imageSearchVenues,
    venues,
    normalizedSubmittedSearch,
    submittedSearchHasTone,
    exactSubmittedSearch,
    toneInsensitiveSubmittedSearch,
  ]);

  const categorySections = useMemo(() => {
    const groupedByCategory = new Map();

    displayedVenues.forEach((venue) => {
      const categoryId = getVenueCategoryId(venue);

      if (categoryId === null) {
        return;
      }

      if (!groupedByCategory.has(categoryId)) {
        groupedByCategory.set(categoryId, []);
      }

      groupedByCategory.get(categoryId).push(venue);
    });

    const visibleSections = categories
      .map((category) => {
        const categoryId = Number(category.id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          return null;
        }

        if (selectedCategoryIds.length && !selectedCategoryIds.includes(categoryId)) {
          return null;
        }

        return {
          id: categoryId,
          name: category.name,
          description: category.description,
          venues: groupedByCategory.get(categoryId) || []
        };
      })
      .filter(Boolean);

    groupedByCategory.forEach((categoryVenues, categoryId) => {
      if (visibleSections.some((section) => section.id === categoryId)) {
        return;
      }

      if (selectedCategoryIds.length && !selectedCategoryIds.includes(categoryId)) {
        return;
      }

      visibleSections.push({
        id: categoryId,
        name: categoryVenues[0]?.category_name || `Category ${categoryId}`,
        description: '',
        venues: categoryVenues
      });
    });

    return visibleSections;
  }, [categories, displayedVenues, selectedCategoryIds]);

  const uncategorizedVenues = useMemo(
    () => displayedVenues.filter((venue) => getVenueCategoryId(venue) === null),
    [displayedVenues]
  );

  const activeFilterCount =
    selectedCategoryIds.length +
    selectedWardIds.length +
    selectedServiceIds.length +
    (searchInput.trim() ? 1 : 0);
  const appliedFilterCount =
    appliedCategoryIds.length +
    appliedWardIds.length +
    appliedServiceIds.length +
    (submittedSearch.trim() ? 1 : 0);
  const isSearchMode = searchTriggered && !aiSuggestMode;
  const isCondensedMode = isSearchMode || aiSuggestMode;
  const trendingSliderVenues = useMemo(
    () => (trendingVenues.length > 1 ? [...trendingVenues, ...trendingVenues] : trendingVenues),
    [trendingVenues]
  );
  const forYouSliderVenues = useMemo(
    () => (forYouVenues.length > 1 ? [...forYouVenues, ...forYouVenues] : forYouVenues),
    [forYouVenues]
  );

  const weatherDisplayText = useMemo(() => {
    if (weatherLoading) {
      return 'Loading weather...';
    }

    if (!currentWeather) {
      return 'Weather unavailable';
    }

    const temperature = Number(currentWeather.temperatureC);
    const temperatureText = Number.isFinite(temperature)
      ? `${Math.round(temperature)}°C`
      : 'N/A';
    const description = String(currentWeather.conditionDescription || currentWeather.conditionMain || 'Unknown weather')
      .trim();

    return `${temperatureText} • ${description}`;
  }, [currentWeather, weatherLoading]);

  const weatherEmoji = useMemo(
    () => resolveWeatherEmoji(currentWeather?.conditionMain),
    [currentWeather?.conditionMain]
  );

  const searchPageSize = 8;
  const totalSearchPages = Math.max(1, Math.ceil(displayedVenues.length / searchPageSize));
  const pagedSearchVenues = useMemo(() => {
    const start = (searchPage - 1) * searchPageSize;
    return displayedVenues.slice(start, start + searchPageSize);
  }, [displayedVenues, searchPage]);

  const visibleAiVenues = useMemo(
    () => aiSuggestedVenues.slice(0, aiVisibleCount),
    [aiSuggestedVenues, aiVisibleCount]
  );
  const hasMoreAiVenues = aiSuggestedVenues.length > 8 && visibleAiVenues.length < aiSuggestedVenues.length;

  const userPreferenceSignal = useMemo(() => {
    if (!userPreference) {
      return '';
    }

    const preferredTimes = Array.isArray(userPreference.preferredTimes)
      ? [...userPreference.preferredTimes].sort().join('|')
      : '';
    const interests = Array.isArray(userPreference.interests)
      ? [...userPreference.interests].sort().join('|')
      : '';

    return [
      userPreference.ageRangeKey || '',
      userPreference.preferredGender || '',
      preferredTimes,
      interests,
      userPreference.updatedAt || '',
      userPreference.onboardingCompleted ? '1' : '0'
    ].join('::');
  }, [userPreference]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!token) {
        setFavoriteKeys(new Set());
        return;
      }
      try {
        const response = await axios.get(`${apiUrl}/users/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const nextKeys = new Set(
          (response.data?.favorites || []).map(
            (item) => `${item.itemType}:${item.itemId}`
          )
        );
        setFavoriteKeys(nextKeys);
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
      }
    };

    fetchFavorites();
  }, [apiUrl, token]);

  useEffect(() => {
    if (!token) {
      setUserPreference(null);
      setShowPreferenceWizard(false);
      return;
    }

    let isMounted = true;

    const loadUserPreference = async () => {
      setPreferencesLoading(true);

      try {
        const response = await fetchUserPreferences();
        if (!isMounted) {
          return;
        }

        const preference = response?.preference || null;
        setUserPreference(preference);

        if (!preference?.onboardingCompleted) {
          setShowPreferenceWizard(true);
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setUserPreference(null);
      } finally {
        if (isMounted) {
          setPreferencesLoading(false);
        }
      }
    };

    loadUserPreference();

    return () => {
      isMounted = false;
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !userPreference?.onboardingCompleted) {
      setForYouVenues([]);
      setForYouError('');
      return;
    }

    let isMounted = true;

    const loadForYouVenues = async () => {
      setForYouLoading(true);
      setForYouError('');

      try {
        const params = { limit: 12 };
        const latitude = Number(geoCoordinates.latitude);
        const longitude = Number(geoCoordinates.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params.latitude = latitude;
          params.longitude = longitude;
        }

        const response = await fetchForYouRecommendations(params);

        if (!isMounted) {
          return;
        }

        setForYouVenues(Array.isArray(response?.recommendations) ? response.recommendations : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setForYouError(error?.response?.data?.message || 'Unable to load personalized places right now.');
        setForYouVenues([]);
      } finally {
        if (isMounted) {
          setForYouLoading(false);
        }
      }
    };

    loadForYouVenues();

    return () => {
      isMounted = false;
    };
  }, [token, userPreferenceSignal, geoCoordinates.latitude, geoCoordinates.longitude]);

  useEffect(() => {
    let isMounted = true;

    const loadTrendingVenues = async () => {
      setTrendingLoading(true);
      setTrendingError('');

      try {
        const rows = await fetchTrendingVenues(12);
        if (!isMounted) {
          return;
        }

        setTrendingVenues(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTrendingVenues([]);
        setTrendingError(error?.response?.data?.message || 'Unable to load trending places right now.');
      } finally {
        if (isMounted) {
          setTrendingLoading(false);
        }
      }
    };

    loadTrendingVenues();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadFilterOptions = async () => {
      setLoadingFilters(true);
      setFilterError('');

      try {
        const [categoryData, wardData, serviceData] = await Promise.all([
          fetchPlaceCategories(),
          fetchWards({ summary: 'true' }),
          fetchMerchantServices()
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(
          Array.isArray(categoryData)
            ? categoryData.filter((category) => category.is_active !== false)
            : []
        );
        setWards(Array.isArray(wardData) ? wardData : []);
        setServices(
          Array.isArray(serviceData)
            ? serviceData.filter((service) => service.is_active !== false)
            : []
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFilterError(error.response?.data?.message || 'Unable to load filter options right now.');
        setCategories([]);
        setWards([]);
        setServices([]);
      } finally {
        if (isMounted) {
          setLoadingFilters(false);
        }
      }
    };

    loadFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVenues = async () => {
      setLoadingVenues(true);
      setVenueError('');
      setVenues([]);

      try {
        const venueData = await fetchVenues({ ...venueParams });

        if (!isMounted) {
          return;
        }

        setVenues(Array.isArray(venueData) ? venueData : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVenueError(error.response?.data?.message || 'Unable to load venues right now.');
        setVenues([]);
      } finally {
        if (isMounted) {
          setLoadingVenues(false);
        }
      }
    };

    loadVenues();

    return () => {
      isMounted = false;
    };
  }, [venueParams]);

  useEffect(() => {
    let pollingInFlight = false;

    const intervalId = window.setInterval(async () => {
      if (pollingInFlight) {
        return;
      }

      pollingInFlight = true;

      try {
        const liveVenueData = await fetchVenues({ ...venueParams, live: 'true' });
        setVenues(Array.isArray(liveVenueData) ? liveVenueData : []);
      } catch {
        // Keep currently rendered venue list on transient polling errors.
      } finally {
        pollingInFlight = false;
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [venueParams]);

  useEffect(() => {
    setSearchPage(1);
  }, [submittedSearch]);

  useEffect(() => {
    const snapshot = location.state?.restoreOverviewSnapshot;
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    const restoredSuggestedVenues = Array.isArray(snapshot.aiSuggestedVenues)
      ? snapshot.aiSuggestedVenues
      : [];
    const restoredBaseVenues = Array.isArray(snapshot.aiBaseVenues)
      ? snapshot.aiBaseVenues
      : restoredSuggestedVenues;
    const restoredVisibleCount = Number(snapshot.aiVisibleCount);

    setAiSuggestMode(Boolean(snapshot.aiSuggestMode));
    setAiSuggestedVenues(restoredSuggestedVenues);
    setAiBaseVenues(restoredBaseVenues);
    setAiVisibleCount(
      Number.isFinite(restoredVisibleCount) && restoredVisibleCount > 0
        ? Math.min(restoredVisibleCount, 40)
        : 8
    );
    setAiContext(snapshot.aiContext && typeof snapshot.aiContext === 'object' ? snapshot.aiContext : null);
    setAiRefineInput(String(snapshot.aiRefineInput || '').trim());
    setAiRefineMeta(snapshot.aiRefineMeta && typeof snapshot.aiRefineMeta === 'object' ? snapshot.aiRefineMeta : null);
    setAiRefineError('');
    setAiSuggestError('');
    setSearchTriggered(false);
    setShowFilterPanel(false);

    const nextState = { ...(location.state || {}) };
    delete nextState.restoreOverviewSnapshot;
    navigate(location.pathname, {
      replace: true,
      state: Object.keys(nextState).length ? nextState : null
    });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!location.state?.resetOverview) {
      return;
    }
    setSelectedCategoryIds([]);
    setExpandedCategoryRootIds([]);
    setSelectedWardIds([]);
    setSelectedServiceIds([]);
    setAppliedCategoryIds([]);
    setAppliedWardIds([]);
    setAppliedServiceIds([]);
    setSearchInput('');
    setSubmittedSearch('');
    setSearchTriggered(false);
    setAiSuggestMode(false);
    setAiSuggestError('');
    setAiSuggestedVenues([]);
    setAiBaseVenues([]);
    setAiVisibleCount(8);
    setAiContext(null);
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setImageSearchVenues([]);
    setShowFilterPanel(false);
    setSearchPage(1);
  }, [location.state?.resetOverview]);

  const isFavorite = (itemType, itemId) => favoriteKeys.has(`${itemType}:${itemId}`);

  const handleToggleFavorite = async (item, itemType) => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await axios.post(
        `${apiUrl}/users/favorites/toggle`,
        {
          itemId: item.id,
          itemType,
          name: item.name,
          image: item.image,
          price: item.price,
          description: item.description
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const key = `${itemType}:${item.id}`;
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (response.data?.favorited) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId]
    );
  };

  const toggleCategoryBranchSelection = (categoryId) => {
    setExpandedCategoryRootIds((currentIds) => (
      currentIds.includes(categoryId)
        ? currentIds
        : [...currentIds, categoryId]
    ));

    setSelectedCategoryIds((currentIds) => {
      return currentIds.includes(categoryId)
        ? currentIds.filter((currentId) => currentId !== categoryId)
        : [...currentIds, categoryId];
    });
  };

  const toggleWardSelection = (wardId) => {
    setSelectedWardIds((current) =>
      current.includes(wardId)
        ? current.filter((item) => item !== wardId)
        : [...current, wardId]
    );
  };

  const toggleServiceSelection = (serviceId) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((item) => item !== serviceId)
        : [...current, serviceId]
    );
  };

  const applySearch = () => {
    setAiSuggestMode(false);
    setAiSuggestError('');
    setAiBaseVenues([]);
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setImageSearchVenues([]);
    setSubmittedSearch(searchInput.trim());
    setAppliedCategoryIds(selectedCategoryIds);
    setAppliedWardIds(selectedWardIds);
    setAppliedServiceIds(selectedServiceIds);
    setSearchTriggered(true);
    setShowFilterPanel(false);
  };

  const clearAllFilters = () => {
    setAiSuggestMode(false);
    setAiSuggestError('');
    setAiBaseVenues([]);
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setImageSearchVenues([]);
    setSelectedCategoryIds([]);
    setExpandedCategoryRootIds([]);
    setSelectedWardIds([]);
    setSelectedServiceIds([]);
    setAppliedCategoryIds([]);
    setAppliedWardIds([]);
    setAppliedServiceIds([]);
    setSearchInput('');
    setSubmittedSearch('');
    setSearchTriggered(true);
  };

  const resetSearchToStart = () => {
    setAiSuggestMode(false);
    setAiSuggestError('');
    setAiSuggestedVenues([]);
    setAiBaseVenues([]);
    setAiVisibleCount(8);
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setImageSearchVenues([]);
    setSubmittedSearch('');
    setSearchTriggered(false);
    setSearchPage(1);
    setShowFilterPanel(false);
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleAiSuggest = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (preferencesLoading) {
      return;
    }

    if (!userPreference?.onboardingCompleted) {
      setShowPreferenceWizard(true);
      return;
    }

    setAiSuggestMode(true);
    setAiSuggestLoading(true);
    setAiSuggestError('');
    setAiSuggestedVenues([]);
    setAiBaseVenues([]);
    setAiVisibleCount(8);
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setSearchTriggered(false);
    setShowFilterPanel(false);

    try {
      const fallbackCoordinates = hasValidCoordinates(geoCoordinates)
        ? geoCoordinates
        : DEFAULT_CITY_COORDINATES;
      const latestCoordinates = await resolveBrowserCoordinates({
        fallbackCoordinates,
        timeoutMs: 9000,
        maximumAgeMs: 0,
      });
      setGeoCoordinates(latestCoordinates);

      const params = {
        limit: 24,
        preferOpenNow: true,
        currentTimeIso: new Date().toISOString()
      };

      const latitude = Number(latestCoordinates.latitude);
      const longitude = Number(latestCoordinates.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        params.latitude = latitude;
        params.longitude = longitude;
      }

      const weatherMain = String(currentWeather?.conditionMain || '').trim();
      if (weatherMain) {
        params.weatherMain = weatherMain;
      }

      const response = await fetchForYouRecommendations(params);
      const recommendedVenues = Array.isArray(response?.recommendations) ? response.recommendations : [];

      setAiContext(response?.context || null);
      setAiSuggestedVenues(recommendedVenues);
      setAiBaseVenues(recommendedVenues);
      setAiVisibleCount(8);

      if (!response?.preferencesCompleted) {
        setShowPreferenceWizard(true);
      }
    } catch (error) {
      setAiContext(null);
      setAiSuggestedVenues([]);
      setAiBaseVenues([]);
      setAiSuggestError(error?.response?.data?.message || 'Unable to load AI suggestions right now.');
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleClearAiRefine = () => {
    setAiRefineInput('');
    setAiRefineError('');
    setAiRefineMeta(null);
    setAiVisibleCount(8);

    if (aiBaseVenues.length) {
      setAiSuggestedVenues(aiBaseVenues);
    }
  };

  const handleRunAiRefine = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    const refineText = aiRefineInput.trim();
    if (!refineText) {
      setAiRefineError('Please enter a refine request first.');
      return;
    }

    setAiRefineLoading(true);
    setAiRefineError('');

    try {
      const fallbackCoordinates = hasValidCoordinates(geoCoordinates)
        ? geoCoordinates
        : DEFAULT_CITY_COORDINATES;
      const latestCoordinates = await resolveBrowserCoordinates({
        fallbackCoordinates,
        timeoutMs: 9000,
        maximumAgeMs: 0,
      });
      setGeoCoordinates(latestCoordinates);

      const payload = {
        query: refineText,
        scope: 'global',
        limit: 24,
        currentTimeIso: new Date().toISOString()
      };

      const latitude = Number(latestCoordinates.latitude);
      const longitude = Number(latestCoordinates.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      const weatherMain = String(currentWeather?.conditionMain || '').trim();
      if (weatherMain) {
        payload.weatherMain = weatherMain;
      }

      const response = await refineForYouRecommendations(payload);
      const refinedVenues = Array.isArray(response?.recommendations) ? response.recommendations : [];

      if (response?.context) {
        setAiContext(response.context);
      }

      if (response?.refine) {
        setAiRefineMeta(response.refine);
      }

      setAiSuggestedVenues(refinedVenues);
      setAiVisibleCount(8);

      if (response?.refine?.understood === false) {
        setAiRefineError(
          response?.refine?.summary
          || 'AI could not confidently understand this refine sentence. Please rewrite with clearer details.'
        );
        return;
      }

      if (!refinedVenues.length) {
        setAiRefineError('No places matched this refine request. Try broader wording.');
      }
    } catch (error) {
      setAiRefineError(error?.response?.data?.message || 'Unable to refine AI suggestions right now.');
    } finally {
      setAiRefineLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadRealtimeWeather = async () => {
      setWeatherLoading(true);
      setWeatherError('');

      try {
        const coordinates = await resolveBrowserCoordinates({
          fallbackCoordinates: DEFAULT_CITY_COORDINATES,
          timeoutMs: 8000,
          maximumAgeMs: 60 * 1000,
        });
        if (!isMounted) {
          return;
        }

        setGeoCoordinates(coordinates);

        const response = await fetchCurrentWeather({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        });

        if (!isMounted) {
          return;
        }

        const weatherPayload = response?.weather || null;
        setCurrentWeather(weatherPayload || buildLocalFallbackWeather());
        setCurrentLocation(DEFAULT_CITY_LABEL);
        setWeatherError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCurrentWeather(buildLocalFallbackWeather());
        setCurrentLocation(DEFAULT_CITY_LABEL);
        setWeatherError('');
      } finally {
        if (isMounted) {
          setWeatherLoading(false);
        }
      }
    };

    loadRealtimeWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const updateClock = () => {
      setLocationClock(formatLocationClockByOffset(currentWeather?.timezoneOffsetSeconds));
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentWeather?.timezoneOffsetSeconds]);

  const handlePickImage = (source) => {
    setImageError('');

    if (source === 'camera') {
      // Try to open an in-app camera overlay (desktop) first.
      // If getUserMedia fails, fall back to the native file input (mobile behavior).
      openCameraOverlay();
      return;
    }

    libraryInputRef.current?.click();
  };

  const openCameraOverlay = async () => {
    setShowCameraOverlay(true);
    try {
      await startCamera();
    } catch (err) {
      // Fallback to native file input (useful on mobile where getUserMedia may be restricted)
      setShowCameraOverlay(false);
      cameraInputRef.current?.click();
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not supported');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  };

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    } catch (e) {
      // ignore
    }
  };

  const closeCameraOverlay = () => {
    stopCamera();
    setShowCameraOverlay(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Failed to capture'));
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        // show preview quickly
        try {
          setPreviewUrl(URL.createObjectURL(file));
        } catch (e) {}
        closeCameraOverlay();
        try {
          await runVisionSearchWithFile(file, imageSearchTarget);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 'image/jpeg');
    });
  };

  const runVisionSearchWithFile = async (file, target) => {
    setImageSearchLoading(true);
    setImageError('');

    try {
      const imageDataUrl = await createCompressedImageDataUrl(file);
      const response = await searchVenuesByImage({
        imageDataUrl,
        target,
        language
      });

      const directVenueResults = Array.isArray(response?.venueResults)
        ? response.venueResults
        : [];
      const nextSearchText = String(response?.searchText || response?.detectedLabel || '').trim();
      const isUnknownLabel = nextSearchText.toLowerCase() === 'unknown';
      const readableHint = [
        ...(Array.isArray(response?.searchTerms) ? response.searchTerms : [])
      ]
        .map((item) => String(item || '').trim())
        .find((item) => item && item.toLowerCase() !== 'unknown' && item.toLowerCase() !== 'place' && item.toLowerCase() !== 'food');
      const fallbackSearchText = target === 'food'
        ? (language === 'en' ? 'Detected food from image' : 'Món ăn nhận diện từ ảnh')
        : (language === 'en' ? 'Detected place from image' : 'Địa điểm nhận diện từ ảnh');
      const resolvedSearchText = (!nextSearchText || isUnknownLabel)
        ? (readableHint || fallbackSearchText)
        : nextSearchText;

      setAiSuggestMode(false);
      setAiSuggestError('');
      setAiSuggestedVenues([]);
      setAiBaseVenues([]);
      setAiRefineInput('');
      setAiRefineError('');
      setAiRefineMeta(null);

      setSelectedCategoryIds([]);
      setExpandedCategoryRootIds([]);
      setSelectedWardIds([]);
      setSelectedServiceIds([]);
      setAppliedCategoryIds([]);
      setAppliedWardIds([]);
      setAppliedServiceIds([]);

      setImageSearchVenues(directVenueResults);

      setSearchInput(resolvedSearchText);
      setSubmittedSearch(resolvedSearchText);
      setSearchTriggered(true);
      setSearchPage(1);
      setShowFilterPanel(false);

      closeImageModal();
    } catch (error) {
      setImageError(error?.response?.data?.message || (language === 'en'
        ? 'Unable to analyze this image right now.'
        : 'Không thể phân tích ảnh lúc này.'));
    } finally {
      setImageSearchLoading(false);
    }
  };

  const handleImageSelected = async (event) => {
    const inputElement = event.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    inputElement.value = '';

    if (!file.type.startsWith('image/')) {
      setImageError(language === 'en' ? 'Please choose an image file.' : 'Vui lòng chọn tệp hình ảnh.');
      return;
    }

    if (!imageSearchTarget) {
      setImageError(language === 'en' ? 'Please select search mode first.' : 'Vui lòng chọn kiểu tìm kiếm trước.');
      return;
    }

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    await runVisionSearchWithFile(file, imageSearchTarget);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleExploreVenue = (venue, options = {}) => {
    if (!venue?.id) {
      navigate('/discovery');
      return;
    }

    const source = String(options?.source || '').trim().toLowerCase();
    const assignmentId = source === 'trending'
      ? Number.parseInt(
        options?.assignmentId || venue?.trendPromotion?.assignmentId,
        10
      )
      : null;
    const trendClickContext = source === 'trending' && Number.isFinite(assignmentId) && assignmentId > 0
      ? {
        assignmentId: String(assignmentId),
        source: 'overview-trending',
        clickToken: createTrendClickToken()
      }
      : null;

    const overviewReturnSnapshot = {
      aiSuggestMode,
      aiSuggestedVenues: aiSuggestMode ? aiSuggestedVenues : [],
      aiBaseVenues: aiSuggestMode ? aiBaseVenues : [],
      aiVisibleCount: aiSuggestMode ? aiVisibleCount : 8,
      aiContext: aiSuggestMode ? aiContext : null,
      aiRefineInput: aiSuggestMode ? aiRefineInput : '',
      aiRefineMeta: aiSuggestMode ? aiRefineMeta : null
    };

    navigate(`/venues/${venue.id}`, {
      state: {
        fromOverview: true,
        overviewReturnSnapshot,
        trendClickContext
      }
    });
  };

  const handlePreferenceSaved = (savedPreference) => {
    setUserPreference(savedPreference || null);
    setShowPreferenceWizard(false);
  };

  const isContinuousSliderSection = (sectionId) => CONTINUOUS_SLIDER_SECTION_IDS.has(String(sectionId));

  const getSliderLoopWidth = (sectionId, node) => {
    if (!node) {
      return 0;
    }

    const key = String(sectionId);
    if (!isContinuousSliderSection(key)) {
      return Math.max(0, node.scrollWidth - node.clientWidth);
    }

    const cachedLoopWidth = Number(sliderLoopWidthRefs.current.get(key));
    if (Number.isFinite(cachedLoopWidth) && cachedLoopWidth > 0) {
      return cachedLoopWidth;
    }

    const resolvedLoopWidth = Math.max(0, Math.round(node.scrollWidth / 2));
    sliderLoopWidthRefs.current.set(key, resolvedLoopWidth);
    return resolvedLoopWidth;
  };

  const normalizeContinuousSliderPosition = (sectionId, node) => {
    if (!node || !isContinuousSliderSection(sectionId)) {
      return;
    }

    const loopWidth = getSliderLoopWidth(sectionId, node);
    if (!loopWidth) {
      return;
    }

    if (node.scrollLeft >= loopWidth) {
      node.scrollLeft -= loopWidth;
    } else if (node.scrollLeft < 0) {
      node.scrollLeft += loopWidth;
    }
  };

  const getSliderStepDistance = (node) => {
    if (!node) {
      return 0;
    }

    const firstCard = node.querySelector('.overview-dynamic-card');
    if (!firstCard) {
      return Math.max(1, node.clientWidth || 1);
    }

    const sliderStyles = window.getComputedStyle(node);
    const fallbackGap = Number.parseFloat(sliderStyles.gap || sliderStyles.columnGap || '0') || 0;
    const cardStyles = window.getComputedStyle(firstCard);
    const cardMarginRight = Number.parseFloat(cardStyles.marginRight || '0') || 0;
    const cardWidth = firstCard.getBoundingClientRect().width || 0;
    const step = cardWidth + Math.max(fallbackGap, cardMarginRight);

    return Math.max(1, Math.round(step));
  };

  const updateSliderPager = (sectionId, node) => {
    if (!node) {
      return;
    }

    const key = String(sectionId);
    const viewportWidth = node.clientWidth || 1;
    const loopWidth = getSliderLoopWidth(sectionId, node);
    const effectiveScrollWidth = isContinuousSliderSection(key) && loopWidth
      ? loopWidth
      : node.scrollWidth;
    const maxScroll = Math.max(0, effectiveScrollWidth - viewportWidth);
    const normalizedScrollLeft = isContinuousSliderSection(key) && loopWidth
      ? ((node.scrollLeft % loopWidth) + loopWidth) % loopWidth
      : node.scrollLeft;
    const totalPages = Math.max(1, Math.ceil(maxScroll / viewportWidth) + 1);
    const currentPage = Math.min(totalPages, Math.max(1, Math.round(normalizedScrollLeft / viewportWidth) + 1));

    setSliderPager((prev) => {
      const previous = prev[key];
      if (previous?.currentPage === currentPage && previous?.totalPages === totalPages) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          currentPage,
          totalPages
        }
      };
    });
  };

  const cleanupSliderRegistration = (sectionId) => {
    const key = String(sectionId);
    const cleanup = sliderCleanupRefs.current.get(key);
    if (cleanup) {
      cleanup();
      sliderCleanupRefs.current.delete(key);
    }

    const animationFrameId = sliderAnimationFrameRefs.current.get(key);
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      sliderAnimationFrameRefs.current.delete(key);
    }

    sliderAnimStateRefs.current.delete(key);
    sliderHoverRefs.current.delete(key);
    sliderLoopWidthRefs.current.delete(key);
  };

  const registerSliderRef = (sectionId) => {
    const key = String(sectionId);
    const existingCallback = sliderRefCallbackRefs.current.get(key);

    if (existingCallback) {
      return existingCallback;
    }

    const callback = (node) => {
      cleanupSliderRegistration(key);

      if (!node) {
        sliderRefs.current.delete(key);
        return;
      }

      sliderRefs.current.set(key, node);

      const isContinuous = isContinuousSliderSection(key);
      const handleScroll = () => {
        if (isContinuous) {
          normalizeContinuousSliderPosition(key, node);
        }
        updateSliderPager(key, node);
      };
      const handleMouseEnter = () => {
        sliderHoverRefs.current.set(key, true);
      };
      const handleMouseLeave = () => {
        sliderHoverRefs.current.set(key, false);
      };

      if (isContinuous) {
        sliderHoverRefs.current.set(key, false);
        sliderLoopWidthRefs.current.set(key, Math.max(0, Math.round(node.scrollWidth / 2)));
        node.scrollLeft = 0;
        node.addEventListener('mouseenter', handleMouseEnter);
        node.addEventListener('mouseleave', handleMouseLeave);

        let lastAutoScrollTime = performance.now();
        sliderAnimStateRefs.current.set(key, {
          isActive: false,
          startLeft: 0,
          targetLeft: 0,
          startTime: 0,
          duration: 1000
        });

        const animate = (timestamp) => {
          const manualPauseUntil = Number(sliderManualPauseUntilRefs.current.get(key) || 0);
          const isManualPauseActive = timestamp < manualPauseUntil;
          const isHovered = sliderHoverRefs.current.get(key);
          const animState = sliderAnimStateRefs.current.get(key);

          if (animState && animState.isActive) {
            if (node.style.scrollSnapType !== 'none') {
              node.dataset.originalSnap = node.style.scrollSnapType || '';
              node.style.scrollSnapType = 'none';
            }

            const elapsed = timestamp - animState.startTime;
            const progress = Math.min(1, elapsed / animState.duration);
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            let nextLeft = animState.startLeft + (animState.targetLeft - animState.startLeft) * ease;
            const loopWidth = getSliderLoopWidth(key, node);

            if (loopWidth > 0) {
              if (nextLeft >= loopWidth) {
                nextLeft -= loopWidth;
                animState.startLeft -= loopWidth;
                animState.targetLeft -= loopWidth;
              } else if (nextLeft < 0) {
                nextLeft += loopWidth;
                animState.startLeft += loopWidth;
                animState.targetLeft += loopWidth;
              }
            }

            node.scrollLeft = nextLeft;

            if (progress >= 1) {
              animState.isActive = false;
              lastAutoScrollTime = timestamp;
              node.style.scrollSnapType = node.dataset.originalSnap || '';
              normalizeContinuousSliderPosition(key, node);
              updateSliderPager(key, node);
            }
          } else {
            if (!isHovered && !isManualPauseActive) {
              if (timestamp - lastAutoScrollTime > 3000) {
                const stepDistance = getSliderStepDistance(node) * 4;
                if (animState) {
                  animState.isActive = true;
                  animState.startLeft = node.scrollLeft;
                  animState.targetLeft = node.scrollLeft + stepDistance;
                  animState.startTime = timestamp;
                  animState.duration = 1000;
                }
              }
            } else {
              lastAutoScrollTime = timestamp;
            }
          }

          const nextFrameId = window.requestAnimationFrame(animate);
          sliderAnimationFrameRefs.current.set(key, nextFrameId);
        };

        const frameId = window.requestAnimationFrame(animate);
        sliderAnimationFrameRefs.current.set(key, frameId);
      }

      node.addEventListener('scroll', handleScroll, { passive: true });
      updateSliderPager(key, node);

      sliderCleanupRefs.current.set(key, () => {
        node.removeEventListener('scroll', handleScroll);
        if (isContinuous) {
          node.removeEventListener('mouseenter', handleMouseEnter);
          node.removeEventListener('mouseleave', handleMouseLeave);
        }
      });
    };

    sliderRefCallbackRefs.current.set(key, callback);
    return callback;
  };

  const scrollCategorySlider = (sectionId, direction) => {
    const key = String(sectionId);
    const node = sliderRefs.current.get(key);
    if (!node) return;

    const viewportWidth = node.clientWidth || 1;
    const loopWidth = getSliderLoopWidth(key, node);

    if (isContinuousSliderSection(key) && loopWidth) {
      const animState = sliderAnimStateRefs.current.get(key);
      const stepDistance = getSliderStepDistance(node) * 4;
      sliderManualPauseUntilRefs.current.set(key, performance.now() + 4000);
      if (animState) {
        animState.isActive = true;
        animState.startLeft = node.scrollLeft;
        animState.targetLeft = node.scrollLeft + (stepDistance * direction);
        animState.startTime = performance.now();
        animState.duration = 800;
      }
      return;
    }

    const maxScroll = Math.max(0, node.scrollWidth - viewportWidth);
    const targetLeft = Math.max(0, Math.min(maxScroll, node.scrollLeft + viewportWidth * direction));

    node.scrollTo({
      left: targetLeft,
      behavior: 'smooth'
    });
  };

  const handleSliderDotClick = (sectionId, targetPage) => {
    const key = String(sectionId);
    const node = sliderRefs.current.get(key);
    if (!node) {
      return;
    }

    const clampedPage = Math.max(1, Number(targetPage) || 1);
    const loopWidth = getSliderLoopWidth(key, node);
    if (isContinuousSliderSection(key) && loopWidth) {
      const animState = sliderAnimStateRefs.current.get(key);
      sliderManualPauseUntilRefs.current.set(key, performance.now() + 4000);
      if (animState) {
        animState.isActive = true;
        animState.startLeft = node.scrollLeft;
        animState.targetLeft = Math.min(loopWidth, (clampedPage - 1) * node.clientWidth);
        animState.startTime = performance.now();
        animState.duration = 800;
      }
      return;
    }

    node.scrollTo({
      left: (clampedPage - 1) * node.clientWidth,
      behavior: 'smooth'
    });
  };

  const renderSliderPaginationDots = (sectionId) => {
    const key = String(sectionId);
    const pager = sliderPager[key] || { currentPage: 1, totalPages: 1 };
    if (pager.totalPages <= 1) {
      return null;
    }

    return (
      <div className="overview-slider-dots" aria-label={`Slider pages for ${key}`}>
        {Array.from({ length: pager.totalPages }).map((_, index) => {
          const page = index + 1;
          const isActive = page === pager.currentPage;
          return (
            <button
              key={`slider-dot-${key}-${page}`}
              type="button"
              className={`overview-slider-dot ${isActive ? 'is-active' : ''}`.trim()}
              aria-label={`Go to page ${page}`}
              aria-current={isActive ? 'true' : 'false'}
              onClick={() => handleSliderDotClick(sectionId, page)}
            />
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    const handleWindowResize = () => {
      sliderRefs.current.forEach((node, sectionId) => updateSliderPager(sectionId, node));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      sliderCleanupRefs.current.forEach((cleanup) => cleanup());
      sliderCleanupRefs.current.clear();
      sliderHoverRefs.current.clear();
      sliderLoopWidthRefs.current.clear();
      sliderAnimationFrameRefs.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
      sliderAnimationFrameRefs.current.clear();
      sliderAnimStateRefs.current.clear();
    };
  }, []);

  return (
    <div className={`overview-page ${isCondensedMode ? 'is-search' : ''}`.trim()}>
      {!isCondensedMode && (
        <section className="overview-hero">
          <div className="overview-hero-visual">
            <div className="overview-hero-plate">
              <img
                src={carouselImages[carouselIndex].src}
                alt={carouselImages[carouselIndex].alt}
                className="overview-hero-image"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-top">
              <img
                src="https://images.unsplash.com/photo-1523906630133-f6934a1ab2b9?auto=format&fit=crop&w=400&q=80"
                alt="Dragon Bridge"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-bottom-left">
              <img
                src="https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80"
                alt="Food side dish"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-bottom-right">
              <img
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80"
                alt="Ba Na Hills"
              />
            </div>
          </div>

          <button type="button" className="overview-hero-arrow" aria-label="Explore more" />

          <div className="overview-hero-copy">
            <p className="overview-hero-kicker">{t.hero.kicker}</p>
            {renderHighlightedTitle(t.hero.title)}
            <p>
              {t.hero.description}
            </p>

            <div className="overview-hero-actions" data-onboarding="overview-hero-actions">
              <button 
                type="button" 
                className="overview-hero-button overview-hero-button-primary"
                onClick={openImageModal}
              >
                {t.hero.findByPictures}
              </button>
              <button 
                type="button" 
                className="overview-hero-button overview-hero-button-secondary"
                onClick={handleMerchantButtonClick}
              >
                {t.hero.merchant}
              </button>
            </div>
          </div>
        </section>
      )}

      {showImageSearch && (
        <div className="overview-image-overlay" onClick={closeImageModal}>
          <div className="overview-image-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="overview-image-close"
              aria-label="Close image search"
              onClick={closeImageModal}
            >
              ×
            </button>
            <div className="overview-image-search-panel">
              {!imageSearchTarget ? (
                <div className="overview-image-step-root">
                  <div className="overview-image-search-actions">
                    <button
                      type="button"
                      className="overview-image-button food"
                      onClick={() => setImageSearchTarget('food')}
                      disabled={imageSearchLoading}
                    >
                      {t.hero.searchFood}
                    </button>
                    <button
                      type="button"
                      className="overview-image-button place"
                      onClick={() => setImageSearchTarget('place')}
                      disabled={imageSearchLoading}
                    >
                      {t.hero.searchPlace}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overview-image-step-root">
                  <div className="overview-image-step-head">
                    <button
                      type="button"
                      className="overview-image-back"
                      onClick={() => {
                        setImageSearchTarget('');
                        clearSelectedImage();
                      }}
                      disabled={imageSearchLoading}
                    >
                      {t.hero.backToSearchMode}
                    </button>
                  </div>

                  <div className="overview-image-search-actions overview-image-source-actions">
                    <button
                      type="button"
                      className="overview-image-button camera"
                      onClick={() => handlePickImage('camera')}
                      disabled={imageSearchLoading}
                    >
                      {imageSearchLoading ? t.hero.analyzingImage : t.hero.takeNewPhoto}
                    </button>
                    <button
                      type="button"
                      className="overview-image-button library"
                      onClick={() => handlePickImage('library')}
                      disabled={imageSearchLoading}
                    >
                      {imageSearchLoading ? t.hero.analyzingImage : t.hero.chooseFromLibrary}
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={libraryInputRef}
                type="file"
                accept="image/*"
                className="overview-image-input"
                onChange={handleImageSelected}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="overview-image-input"
                onChange={handleImageSelected}
              />

              {showCameraOverlay && (
                <div className="overview-camera-overlay">
                  <div className="overview-camera-inner">
                    <video ref={videoRef} className="overview-camera-video" playsInline muted />
                    <div className="overview-camera-actions">
                      <button type="button" className="overview-camera-capture" onClick={capturePhoto} disabled={imageSearchLoading}>
                        {t.hero.takeNewPhoto}
                      </button>
                      <button type="button" className="overview-camera-cancel" onClick={closeCameraOverlay} disabled={imageSearchLoading}>
                        {t.hero.backToSearchMode}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {previewUrl && (
                <div className="overview-image-preview">
                  <div className="overview-image-thumb">
                    <img src={previewUrl} alt={t.hero.selectedImage} />
                    <button type="button" className="overview-image-remove" onClick={clearSelectedImage} aria-label={t.hero.removeImage}>
                      −
                    </button>
                  </div>
                </div>
              )}

              {imageError && <div className="overview-image-error">{imageError}</div>}
            </div>
          </div>
        </div>
      )}

      <section
        className={`overview-search ${isCondensedMode ? 'is-searching' : ''}`.trim()}
        data-onboarding="overview-search"
      >
        <div className="overview-search-top">
          <div className="overview-search-headline">
            <h2>Explore with live filters</h2>
            <p>Search by place categories, ward naming, and merchant services.</p>
          </div>

          {currentLocation && (
            <div className="overview-location-info overview-location-inline">
              <span className="overview-location-text">
                <span aria-hidden="true">📍</span>
                <span>{currentLocation}</span>
              </span>
              <span className="overview-weather">
                <span className="overview-weather-icon" aria-hidden="true">{weatherEmoji}</span>
                <span className="overview-weather-text">{weatherDisplayText}</span>
                {locationClock ? <span className="overview-location-time">{locationClock}</span> : null}
              </span>
              {weatherError ? <span className="overview-weather-error">{weatherError}</span> : null}
            </div>
          )}
        </div>

        <div className="overview-search-row">
          <label className="overview-address-field">
            <span className="overview-address-icon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search venue name, address, ward, or service"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
          </label>

          <button type="button" className="overview-search-submit" onClick={applySearch}>
            🔍 Search
          </button>

          <button
            type="button"
            className={`overview-search-filter ${showFilterPanel ? 'is-active' : ''}`}
            onClick={() => setShowFilterPanel((current) => !current)}
            data-onboarding="overview-filter-button"
          >
            Filter
          </button>

          {/* AI suggestion button */}
          <button
            type="button"
            className="overview-search-ai"
            aria-label={t.search.aiSuggest}
            onClick={handleAiSuggest}
            disabled={aiSuggestLoading || preferencesLoading}
            data-onboarding="overview-ai-button"
          >
            {aiSuggestLoading ? 'Thinking...' : t.search.aiSuggest}
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <div className="overview-active-filters">
            <span>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
            <button type="button" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        {showFilterPanel ? (
          <div className="overview-filter-panel" role="region" aria-label="Filter options">
            <OverviewCategoryFilterGroup
              rootCategories={rootPlaceCategories}
              childCategoriesByParentId={childCategoriesByParentId}
              selectedValues={selectedCategoryIds}
              expandedRootIds={expandedCategoryRootIds}
              onToggleBranch={toggleCategoryBranchSelection}
              onToggleChild={toggleCategorySelection}
            />

            <FilterGroup
              title="Ward Naming"
              options={wards}
              selectedValues={selectedWardIds}
              optionValue={(ward) => String(ward.ward_id)}
              optionLabel={(ward) => ward.name}
              onToggle={toggleWardSelection}
            />

            <FilterGroup
              title="Services Offered - Merchant"
              options={services}
              selectedValues={selectedServiceIds}
              optionValue={(service) => Number(service.id)}
              optionLabel={(service) => service.name}
              onToggle={toggleServiceSelection}
            />

            {loadingFilters ? <p className="overview-empty-copy">Loading filter options...</p> : null}
            {filterError ? <p className="overview-inline-error">{filterError}</p> : null}
          </div>
        ) : null}
      </section>

      {!isCondensedMode ? (
        <section className="overview-section overview-content-lane overview-for-you-section">
          <div className="overview-section-heading">
            <h2>Trend</h2>
            <span />
            <p className="overview-section-subcopy">
              Promoted places currently being pushed by merchants.
            </p>
          </div>

          {trendingLoading ? <p className="overview-empty-copy">Loading trending places...</p> : null}
          {!trendingLoading && trendingError ? <p className="overview-inline-error">{trendingError}</p> : null}

          {!trendingLoading && !trendingError && trendingVenues.length > 0 ? (
            <div className="overview-category-board">
              <button
                type="button"
                className="overview-slider-btn prev"
                aria-label="Scroll trending left"
                onClick={() => scrollCategorySlider('trending', -1)}
              />
              <div
                className="overview-dynamic-grid overview-dynamic-grid-slider is-continuous"
                ref={registerSliderRef('trending')}
              >
                {trendingSliderVenues.map((venue, index) => (
                  <VenueCard
                    key={`trending-${venue.id}-${venue?.trendPromotion?.assignmentId || 'ad'}-${index}`}
                    venue={venue}
                    isFavorite={isFavorite('place', venue.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onExplore={(nextVenue) => handleExploreVenue(nextVenue, {
                      source: 'trending',
                      assignmentId: nextVenue?.trendPromotion?.assignmentId,
                    })}
                  />
                ))}
              </div>
              <button
                type="button"
                className="overview-slider-btn next"
                aria-label="Scroll trending right"
                onClick={() => scrollCategorySlider('trending', 1)}
              />
              {renderSliderPaginationDots('trending')}
            </div>
          ) : null}

          {!trendingLoading && !trendingError && !trendingVenues.length ? (
            <p className="overview-empty-copy">No promoted trending places are active right now.</p>
          ) : null}
        </section>
      ) : null}

      {!isCondensedMode && token ? (
        <section className="overview-section overview-content-lane overview-for-you-section">
          <div className="overview-section-heading">
            <h2>For You</h2>
            <span />
            <p className="overview-section-subcopy">
              Personalized places based on your profile, interests, and nearby distance.
            </p>
          </div>

          {preferencesLoading ? (
            <p className="overview-empty-copy">Checking your preference profile...</p>
          ) : null}

          {!preferencesLoading && !userPreference?.onboardingCompleted ? (
            <div className="overview-for-you-empty">
              <p>Complete your preference form to unlock personalized recommendations.</p>
              <button type="button" onClick={() => setShowPreferenceWizard(true)}>
                Set preferences
              </button>
            </div>
          ) : null}

          {!preferencesLoading && userPreference?.onboardingCompleted && forYouError ? (
            <p className="overview-inline-error">{forYouError}</p>
          ) : null}

          {!preferencesLoading && userPreference?.onboardingCompleted && forYouLoading ? (
            <p className="overview-empty-copy">Loading personalized places...</p>
          ) : null}

          {!preferencesLoading &&
          userPreference?.onboardingCompleted &&
          !forYouLoading &&
          !forYouError &&
          forYouVenues.length > 0 ? (
            <div className="overview-category-board">
              <button
                type="button"
                className="overview-slider-btn prev"
                aria-label="Scroll For You left"
                onClick={() => scrollCategorySlider('for-you', -1)}
              />
              <div
                className="overview-dynamic-grid overview-dynamic-grid-slider is-continuous"
                ref={registerSliderRef('for-you')}
              >
                {forYouSliderVenues.map((venue, index) => (
                  <VenueCard
                    key={`for-you-${venue.id}-${index}`}
                    venue={venue}
                    isFavorite={isFavorite('place', venue.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onExplore={handleExploreVenue}
                  />
                ))}
              </div>
              <button
                type="button"
                className="overview-slider-btn next"
                aria-label="Scroll For You right"
                onClick={() => scrollCategorySlider('for-you', 1)}
              />
              {renderSliderPaginationDots('for-you')}
            </div>
          ) : null}

          {!preferencesLoading &&
          userPreference?.onboardingCompleted &&
          !forYouLoading &&
          !forYouError &&
          !forYouVenues.length ? (
            <p className="overview-empty-copy">No personalized place found yet. Try updating your preferences.</p>
          ) : null}
        </section>
      ) : null}

      {aiSuggestMode ? (
        <section className="overview-section overview-search-result-section overview-ai-result-section">
          <div className="overview-section-heading">
            <h2>AI Suggested for You</h2>
            <span />
            <p className="overview-section-subcopy">
              Personalized picks based on profile, nearby distance, real-time weather, current time, and opening hours.
            </p>
            {aiContext?.currentTimeWindowLabel ? (
              <p className="overview-ai-context-copy">
                Best for now: {aiContext.currentTimeWindowLabel}
                {aiContext.weatherMain ? ` • Weather: ${aiContext.weatherMain}` : ''}
              </p>
            ) : null}
          </div>

          <div className="overview-ai-refine-panel">
            <label htmlFor="overview-ai-refine-input" className="overview-ai-refine-label">
              Chat refine
            </label>
            <div className="overview-ai-refine-row">
              <input
                id="overview-ai-refine-input"
                type="text"
                className="overview-ai-refine-input"
                value={aiRefineInput}
                onChange={(event) => {
                  setAiRefineInput(event.target.value);
                  if (aiRefineError) {
                    setAiRefineError('');
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!aiRefineLoading) {
                      handleRunAiRefine();
                    }
                  }
                }}
                placeholder='Try: "I want hotpot under 100k, open now"'
              />
              <button
                type="button"
                className="overview-ai-refine-run"
                onClick={handleRunAiRefine}
                disabled={aiRefineLoading || aiSuggestLoading}
              >
                {aiRefineLoading ? (
                  <span className="overview-ai-refine-btn-loading" aria-live="polite">
                    <span className="overview-ai-refine-btn-spinner" aria-hidden="true" />
                    Refining...
                  </span>
                ) : (
                  'Run refine'
                )}
              </button>
              {aiRefineMeta ? (
                <button
                  type="button"
                  className="overview-ai-refine-clear"
                  onClick={handleClearAiRefine}
                  disabled={aiRefineLoading}
                >
                  Clear refine
                </button>
              ) : null}
            </div>

            {aiRefineLoading ? (
              <p className="overview-ai-refine-progress">Analyzing venue services and descriptions...</p>
            ) : null}

            {aiRefineMeta?.summary ? (
              <p className="overview-ai-refine-summary">
                Refine analysis: {aiRefineMeta.summary}
              </p>
            ) : null}
            {aiRefineError ? <p className="overview-inline-error">{aiRefineError}</p> : null}
          </div>

          {aiSuggestLoading ? (
            <div className="overview-ai-loading" role="status" aria-live="polite">
              <div className="overview-ai-loading-orbit" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>AI is analyzing your profile, location, weather, and open venues...</p>
            </div>
          ) : null}

          {!aiSuggestLoading && aiSuggestError ? <p className="overview-inline-error">{aiSuggestError}</p> : null}

          {!aiSuggestLoading && !aiSuggestError && visibleAiVenues.length > 0 ? (
            <div className="overview-search-results">
              <div className="overview-dynamic-grid overview-search-grid overview-ai-grid">
                {visibleAiVenues.map((venue) => (
                  <VenueCard
                    key={`ai-${venue.id}`}
                    venue={venue}
                    isFavorite={isFavorite('place', venue.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onExplore={handleExploreVenue}
                    showDistance
                    userCoordinates={geoCoordinates}
                  />
                ))}
              </div>

              {hasMoreAiVenues ? (
                <div className="overview-ai-show-more-wrap">
                  <button
                    type="button"
                    className="overview-ai-show-more"
                    onClick={() => setAiVisibleCount((prev) => Math.min(prev + 8, aiSuggestedVenues.length))}
                  >
                    khác
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!aiSuggestLoading && !aiSuggestError && !visibleAiVenues.length ? (
            <p className="overview-empty-copy">No AI suggestions available right now. Try again after updating your preferences.</p>
          ) : null}
        </section>
      ) : isSearchMode ? (
        <section className="overview-section overview-search-result-section">
          <div className="overview-section-heading">
            <h2>Search Results</h2>
            <span />
            <p className="overview-section-subcopy">
              Results for "{submittedSearch.trim()}" ({displayedVenues.length})
            </p>
          </div>

          {pagedSearchVenues.length > 0 ? (
            <div className="overview-results-toolbar">
              <button type="button" className="overview-empty-action secondary" onClick={resetSearchToStart}>
                {t.search.back}
              </button>
              <button type="button" className="overview-empty-action primary" onClick={openImageModal}>
                {t.search.searchByImage}
              </button>
            </div>
          ) : null}

          {venueError ? <p className="overview-inline-error">{venueError}</p> : null}

          {!venueError && !loadingVenues && !pagedSearchVenues.length ? (
            <div className="overview-results-empty-state">
              <p className="overview-empty-copy">
                {t.search.noResultHint}
              </p>
              <div className="overview-results-empty-actions">
                <button type="button" className="overview-empty-action secondary" onClick={resetSearchToStart}>
                  {t.search.back}
                </button>
                <button type="button" className="overview-empty-action primary" onClick={openImageModal}>
                  {t.search.searchByImage}
                </button>
              </div>
            </div>
          ) : null}

          <div className="overview-search-results">
            <div className="overview-dynamic-grid overview-search-grid">
              {pagedSearchVenues.map((venue) => (
                <VenueCard
                  key={`search-${venue.id}`}
                  venue={venue}
                  isFavorite={isFavorite('place', venue.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={handleExploreVenue}
                />
              ))}
            </div>

            <div className="overview-pagination">
              <button
                type="button"
                className="overview-pagination-btn"
                disabled={searchPage === 1}
                onClick={() => setSearchPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              {Array.from({ length: totalSearchPages }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={`search-page-${page}`}
                    type="button"
                    className={`overview-pagination-btn ${page === searchPage ? 'is-active' : ''}`.trim()}
                    onClick={() => setSearchPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                className="overview-pagination-btn"
                disabled={searchPage === totalSearchPages}
                onClick={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!isCondensedMode && (
        <section className="overview-section overview-map-section" data-onboarding="overview-map">
          <div className="overview-map-guide-anchor" data-onboarding="overview-map-anchor" aria-hidden="true" />
          <div className="overview-section-heading">
            <h2>City map</h2>
            <span />
          </div>

          <OverviewCityMapCard />
        </section>
      )}

      <UserPreferenceWizard
        isOpen={showPreferenceWizard && Boolean(token)}
        onClose={() => setShowPreferenceWizard(false)}
        onSaved={handlePreferenceSaved}
        initialPreference={userPreference}
        currentCoordinates={geoCoordinates}
      />
    </div>
  );
}

export default OverviewPage;

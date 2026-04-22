import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import axios from 'axios';
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
import OverviewCityMapCard from '../../components/map/OverviewCityMapCard';
import heroFoodImage from '../../assets/images/anh1.png';
import UserPreferenceWizard from '../../components/preferences/UserPreferenceWizard';
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

function VenueCard({ venue, isFavorite, onToggleFavorite, onExplore, showDistance = false, userCoordinates = null }) {
  const venueName = venue.name || venue.title || 'Untitled venue';
  const venueAddress = venue.address || 'Address not available';
  const wardName = venue.ward_name || venue.wardName;
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
  const t = translations[language] || translations.en;
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
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
  const [searchPage, setSearchPage] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [userPreference, setUserPreference] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [showPreferenceWizard, setShowPreferenceWizard] = useState(false);
  const [forYouVenues, setForYouVenues] = useState([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouError, setForYouError] = useState('');
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
  const sliderCleanupRefs = useRef(new Map());
  const searchInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const closeImageModal = () => {
    setShowImageSearch(false);
    setImageSearchTarget('');
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    setImageSearchLoading(false);
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const openImageModal = () => {
    setShowImageSearch(true);
    setImageSearchTarget('');
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    setImageSearchLoading(false);
  };

  const apiUrl = useMemo(
    () =>
      import.meta.env.VITE_API_BASE_URL
      || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api'),
    []
  );

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
    const sliderNode = sliderRefs.current.get('for-you');
    if (!sliderNode) {
      return;
    }

    sliderNode.scrollLeft = 0;
  }, [forYouVenues, userPreferenceSignal]);

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
    setSelectedCategoryIds([]);
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
      cameraInputRef.current?.click();
      return;
    }

    libraryInputRef.current?.click();
  };

  const runVisionSearchWithFile = async (file, target) => {
    setImageSearchLoading(true);
    setImageError('');

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await searchVenuesByImage({
        imageDataUrl,
        target
      });

      const nextSearchText = String(response?.searchText || response?.detectedLabel || '').trim();

      if (!nextSearchText) {
        setImageError(language === 'en'
          ? 'AI could not detect a reliable dish or place from this image.'
          : 'AI chưa nhận diện được món ăn hoặc địa điểm phù hợp từ ảnh này.');
        return;
      }

      setAiSuggestMode(false);
      setAiSuggestError('');
      setAiSuggestedVenues([]);
      setAiBaseVenues([]);
      setAiRefineInput('');
      setAiRefineError('');
      setAiRefineMeta(null);

      setSelectedCategoryIds([]);
      setSelectedWardIds([]);
      setSelectedServiceIds([]);
      setAppliedCategoryIds([]);
      setAppliedWardIds([]);
      setAppliedServiceIds([]);

      setSearchInput(nextSearchText);
      setSubmittedSearch(nextSearchText);
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

  const handleExploreVenue = (venue) => {
    if (!venue?.id) {
      navigate('/discovery');
      return;
    }

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
        overviewReturnSnapshot
      }
    });
  };

  const handlePreferenceSaved = (savedPreference) => {
    setUserPreference(savedPreference || null);
    setShowPreferenceWizard(false);
  };

  const updateSliderPager = (sectionId, node) => {
    if (!node) {
      return;
    }

    const key = String(sectionId);
    const viewportWidth = node.clientWidth || 1;
    const maxScroll = Math.max(0, node.scrollWidth - viewportWidth);
    const totalPages = Math.max(1, Math.ceil(maxScroll / viewportWidth) + 1);
    const currentPage = Math.min(totalPages, Math.max(1, Math.floor(node.scrollLeft / viewportWidth) + 1));

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
  };

  const registerSliderRef = (sectionId) => (node) => {
    const key = String(sectionId);
    cleanupSliderRegistration(sectionId);

    if (!node) {
      sliderRefs.current.delete(sectionId);
      return;
    }

    sliderRefs.current.set(sectionId, node);

    const handleScroll = () => updateSliderPager(sectionId, node);
    node.addEventListener('scroll', handleScroll, { passive: true });
    updateSliderPager(sectionId, node);

    sliderCleanupRefs.current.set(key, () => {
      node.removeEventListener('scroll', handleScroll);
    });
  };

  const scrollCategorySlider = (sectionId, direction) => {
    const node = sliderRefs.current.get(sectionId);
    if (!node) return;

    const viewportWidth = node.clientWidth || 1;
    const maxScroll = Math.max(0, node.scrollWidth - viewportWidth);
    const targetLeft = Math.max(0, Math.min(maxScroll, node.scrollLeft + viewportWidth * direction));

    node.scrollTo({
      left: targetLeft,
      behavior: 'smooth'
    });
  };

  const handleSliderDotClick = (sectionId, targetPage) => {
    const node = sliderRefs.current.get(sectionId);
    if (!node) {
      return;
    }

    const clampedPage = Math.max(1, Number(targetPage) || 1);
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
    };
  }, []);

  return (
    <div className={`overview-page ${isCondensedMode ? 'is-search' : ''}`.trim()}>
      {!isCondensedMode && (
        <section className="overview-hero">
          <div className="overview-hero-visual">
            <div className="overview-hero-plate">
              <img
                src={heroFoodImage}
                alt="Asian food bowl"
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

            <div className="overview-hero-actions">
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
                onClick={() => navigate('/merchant')}
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

      <section className={`overview-search ${isCondensedMode ? 'is-searching' : ''}`.trim()}>
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
            <FilterGroup
              title="Place Categories"
              options={categories}
              selectedValues={selectedCategoryIds}
              optionValue={(category) => Number(category.id)}
              optionLabel={(category) => category.name}
              onToggle={toggleCategorySelection}
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
                className="overview-dynamic-grid overview-dynamic-grid-slider"
                ref={registerSliderRef('for-you')}
              >
                {forYouVenues.map((venue) => (
                  <VenueCard
                    key={`for-you-${venue.id}`}
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
      ) : (
        <section className="overview-section overview-content-lane overview-dynamic-showcase-section">
          <div className="overview-section-heading">
            <h2>Dynamic Category Showcase</h2>
            <span />
          </div>

          {venueError ? <p className="overview-inline-error">{venueError}</p> : null}

          {!loadingVenues && !venueError && !categorySections.length && !uncategorizedVenues.length ? (
            <p className="overview-empty-copy">No approved venues match your current filters.</p>
          ) : null}

          <div className="overview-category-sections">
            {categorySections.map((section) => (
              <article key={`category-section-${section.id}`} className="overview-category-block">
                <header className="overview-category-block-header">
                  <div>
                    <h3>{section.name}</h3>
                    <p>
                      {section.description ||
                        ''}
                    </p>
                  </div>
                </header>

                {section.venues.length ? (
                  <div className="overview-category-board">
                    <button
                      type="button"
                      className="overview-slider-btn prev"
                      aria-label={`Scroll ${section.name} left`}
                      onClick={() => scrollCategorySlider(section.id, -1)}
                    />
                    <div
                      className="overview-dynamic-grid overview-dynamic-grid-slider"
                      ref={registerSliderRef(section.id)}
                    >
                      {section.venues.slice(0, 12).map((venue) => (
                        <VenueCard
                          key={`venue-${section.id}-${venue.id}`}
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
                      aria-label={`Scroll ${section.name} right`}
                      onClick={() => scrollCategorySlider(section.id, 1)}
                    />
                    {renderSliderPaginationDots(section.id)}
                  </div>
                ) : (
                  <p className="overview-empty-copy">No approved places in this category yet.</p>
                )}
              </article>
            ))}

            {!selectedCategoryIds.length && uncategorizedVenues.length ? (
              <article className="overview-category-block">
                <header className="overview-category-block-header">
                  <div>
                    <h3>Other Places</h3>
                    <p>Approved venues that are not linked to a place category yet.</p>
                  </div>
                </header>

                <div className="overview-category-board">
                  <button
                    type="button"
                    className="overview-slider-btn prev"
                    aria-label="Scroll other places left"
                    onClick={() => scrollCategorySlider('uncategorized', -1)}
                  />
                  <div
                    className="overview-dynamic-grid overview-dynamic-grid-slider"
                    ref={registerSliderRef('uncategorized')}
                  >
                    {uncategorizedVenues.slice(0, 12).map((venue) => (
                      <VenueCard
                        key={`uncategorized-${venue.id}`}
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
                    aria-label="Scroll other places right"
                    onClick={() => scrollCategorySlider('uncategorized', 1)}
                  />
                  {renderSliderPaginationDots('uncategorized')}
                </div>
              </article>
            ) : null}
          </div>
        </section>
      )}

      {!isCondensedMode && (
        <section className="overview-section overview-map-section">
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

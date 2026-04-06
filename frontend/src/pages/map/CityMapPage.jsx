import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { APP_ROUTES } from '../../constants/routes';
import { fetchMerchantServices } from '../../services/api/merchantServicesApi';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import { fetchVenueDetails, fetchVenueReviews, fetchVenues } from '../../services/api/venuesApi';
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

function resolveVenuePopupImage(venue) {
  const imageCandidates = [venue?.cover_image_url, venue?.coverImageUrl, venue?.image];

  for (const candidate of imageCandidates) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    if (normalized) {
      return normalized;
    }
  }

  return FALLBACK_VENUE_IMAGE;
}

function renderStars(rating) {
  if (rating === null) {
    return 'No ratings yet';
  }

  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)} ${rating.toFixed(1)}`;
}

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

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
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
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoPreviewAlt, setPhotoPreviewAlt] = useState('');

  const [mapCenter, setMapCenter] = useState(DEFAULT_CITY_CENTER);
  const [mapZoom, setMapZoom] = useState(13);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);

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

  const selectedVenueImages = useMemo(
    () => (selectedVenue ? extractVenueImages(selectedVenue) : []),
    [selectedVenue]
  );

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

  const activeFilterCount =
    appliedCategoryIds.length + appliedWardIds.length + appliedServiceIds.length + (appliedSearch ? 1 : 0);

  const filterParams = useMemo(() => {
    const params = { status: 'approved', compact: 'true' };

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

  const displayedVenues = useMemo(() => {
    if (!normalizedAppliedSearch) {
      return venues;
    }

    return venues.filter((venue) =>
      normalizeSearchText(resolveVenueName(venue)).includes(normalizedAppliedSearch)
    );
  }, [venues, normalizedAppliedSearch]);

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
        setMapCenter(mapCenterFromWards(normalizedWards));
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
  }, []);

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

  const openVenueDetailPanel = (venue) => {
    setSelectedVenueId(venue.id);
    setSelectedVenueDetail(null);
    setVenueReviews([]);
    setVenueReviewsError('');
    setVenueReviewSort('newest');
    setDetailTab('overview');
    setMapCenter([venue.latitude, venue.longitude]);
    setMapZoom(16);
  };

  const closeDetailPanel = () => {
    setSelectedVenueId(null);
    setSelectedVenueDetail(null);
    setVenueDetailError('');
    setVenueReviews([]);
    setVenueReviewsError('');
  };

  const openPhotoPreview = (imageUrl, imageAlt) => {
    setPhotoPreviewUrl(imageUrl);
    setPhotoPreviewAlt(imageAlt || 'Venue photo');
  };

  const closePhotoPreview = () => {
    setPhotoPreviewUrl('');
    setPhotoPreviewAlt('');
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

        setVenueReviews(Array.isArray(reviewResponse?.items) ? reviewResponse.items : []);
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
  }, [selectedVenueId, detailTab, venueReviewSort]);

  return (
    <div className="city-map-fullscreen-page">
      <div className="city-map-fullscreen-canvas">
        <MapContainer center={mapCenter} zoom={mapZoom} preferCanvas style={{ height: '100%', width: '100%' }}>
          <MapViewportController center={mapCenter} zoom={mapZoom} />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />

          <Pane name="city-map-road-labels" style={{ zIndex: 460, pointerEvents: 'none' }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            />
          </Pane>

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

            return (
              <Marker
                key={`city-map-venue-${venue.id}`}
                position={[venue.latitude, venue.longitude]}
                icon={markerIcon}
              >
                <Popup>
                  <div className="city-map-popup">
                    <img
                      src={resolveVenuePopupImage(venue)}
                      alt={resolveVenueName(venue)}
                      className="city-map-popup-image"
                      loading="lazy"
                    />
                    <strong>{resolveVenueName(venue)}</strong>
                    <span>{venue.address || 'Address not available'}</span>
                    <span>{resolveWardName(venue)} | {resolveVenueCategoryName(venue)}</span>
                    <span>{renderStars(resolveVenueRating(venue))}</span>
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
            Back to Home
          </button>
          <h1>City Map Explorer</h1>
          <p>Explore wards and approved places with live filtering.</p>
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
              <h3>Services Offered</h3>
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
                <p>{renderStars(resolveVenueRating(selectedVenue))}</p>
              </div>
              <button type="button" onClick={closeDetailPanel} aria-label="Close venue detail">
                X
              </button>
            </header>

            {selectedVenueImages.length ? (
              <div className="city-map-detail-hero">
                <img src={selectedVenueImages[0]} alt={resolveVenueName(selectedVenue)} loading="lazy" />
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
                  <li><strong>Address</strong><span>{selectedVenue.address || 'Not provided'}</span></li>
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
                {selectedVenueImages.length ? (
                  <div className="city-map-photo-grid">
                    {selectedVenueImages.map((imageUrl, index) => (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        className="city-map-photo-button"
                        onClick={() => openPhotoPreview(imageUrl, `${resolveVenueName(selectedVenue)} ${index + 1}`)}
                        aria-label={`Open photo ${index + 1}`}
                      >
                        <img src={imageUrl} alt={`${resolveVenueName(selectedVenue)} ${index + 1}`} loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="city-map-detail-note">No photos uploaded for this venue.</p>
                )}
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

                {!loadingVenueReviews && !venueReviewsError ? (
                  venueReviews.length ? (
                    <div className="city-map-review-list">
                      {venueReviews.map((review) => (
                        <article key={review.id} className="city-map-review-item">
                          <header>
                            <strong>{review.author_name || 'Anonymous'}</strong>
                            <span>{Number(review.rating || 0).toFixed(1)} / 5</span>
                          </header>
                          <p>{review.comment || 'No written comment provided.'}</p>
                          <small>{formatReviewDateTime(review.created_at)}</small>
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
      </div>
    </div>
  );
}

export default CityMapPage;

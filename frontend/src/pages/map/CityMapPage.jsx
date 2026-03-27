import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { APP_ROUTES } from '../../constants/routes';
import { fetchMerchantServices } from '../../services/api/merchantServicesApi';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import { fetchVenues } from '../../services/api/venuesApi';
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

const markerCache = new Map();
const userLocationIcon = L.divIcon({
  className: 'city-map-user-pin',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80';

function hashCategoryId(value) {
  const text = String(value || 'default');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildCategoryIcon(categoryId, emoji) {
  const palette = ['#0f766e', '#ca8a04', '#be185d', '#9333ea', '#b45309', '#65a30d', '#9a3412'];
  const normalizedEmoji = typeof emoji === 'string' && emoji.trim() ? emoji.trim() : '📍';
  const color = palette[hashCategoryId(categoryId) % palette.length];
  const cacheKey = `${categoryId}-${normalizedEmoji}`;

  if (!markerCache.has(cacheKey)) {
    markerCache.set(
      cacheKey,
      L.divIcon({
        className: 'city-map-category-pin',
        html: `<span style="background:${color}">${normalizedEmoji}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
    );
  }

  return markerCache.get(cacheKey);
}

function resolveVenuePopupImage(venue) {
  const imageCandidates = [
    venue?.cover_image_url,
    venue?.coverImageUrl,
    venue?.image,
  ];

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

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center, zoom]);

  return null;
}

function CityMapPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [error, setError] = useState('');
  const [wardOptions, setWardOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [venues, setVenues] = useState([]);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedWardIds, setSelectedWardIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');

  const [appliedCategoryIds, setAppliedCategoryIds] = useState([]);
  const [appliedWardIds, setAppliedWardIds] = useState([]);
  const [appliedServiceIds, setAppliedServiceIds] = useState([]);
  const [appliedSearch, setAppliedSearch] = useState('');

  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CITY_CENTER);
  const [mapZoom, setMapZoom] = useState(12);
  const [currentPosition, setCurrentPosition] = useState(null);

  const serviceNameById = useMemo(
    () =>
      new Map(
        serviceOptions
          .map((service) => [Number(service.id), service.name])
          .filter(([serviceId, serviceName]) => Number.isInteger(serviceId) && Boolean(serviceName))
      ),
    [serviceOptions]
  );

  const categoryById = useMemo(
    () =>
      new Map(
        categoryOptions
          .map((category) => [Number(category.id), category])
          .filter(([categoryId]) => Number.isInteger(categoryId))
      ),
    [categoryOptions]
  );

  const selectedVenue = useMemo(
    () => venues.find((venue) => Number(venue.id) === Number(selectedVenueId)) || null,
    [venues, selectedVenueId]
  );

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

  const shouldRenderWardTooltips = useMemo(() => wardOptions.length <= 20, [wardOptions.length]);

  const filterParams = useMemo(() => {
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

    if (appliedSearch.trim()) {
      params.q = appliedSearch.trim();
    }

    return params;
  }, [appliedCategoryIds, appliedWardIds, appliedServiceIds, appliedSearch]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        setCurrentPosition(null);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBaseData() {
      setLoading(true);
      setError('');

      try {
        const [wardData, categoryData, serviceData] = await Promise.all([
          fetchWards(),
          fetchPlaceCategories(),
          fetchMerchantServices(),
        ]);

        if (!mounted) {
          return;
        }

        const normalizedWards = normalizeWards(wardData);
        setWardOptions(normalizedWards);
        setMapCenter(mapCenterFromWards(normalizedWards));
        setCategoryOptions(Array.isArray(categoryData) ? categoryData.filter((item) => item.is_active !== false) : []);
        setServiceOptions(Array.isArray(serviceData) ? serviceData.filter((item) => item.is_active !== false) : []);
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(loadError.response?.data?.message || 'Could not load map filter options.');
        setWardOptions([]);
        setCategoryOptions([]);
        setServiceOptions([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadBaseData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadVenues() {
      setVenuesLoading(true);
      setError('');

      try {
        const venueData = await fetchVenues({ ...filterParams, compact: 'true' });

        if (!mounted) {
          return;
        }

        setVenues(normalizeVenues(venueData));
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(loadError.response?.data?.message || 'Could not load venues for this map view.');
        setVenues([]);
      } finally {
        if (mounted) {
          setVenuesLoading(false);
        }
      }
    }

    loadVenues();

    return () => {
      mounted = false;
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
        const liveVenueData = await fetchVenues({ ...filterParams, compact: 'true', live: 'true' });
        setVenues(normalizeVenues(liveVenueData));
      } catch {
        // Keep current map data if one polling cycle fails.
      } finally {
        pollingInFlight = false;
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filterParams]);

  useEffect(() => {
    if (selectedVenueId && !venues.some((venue) => Number(venue.id) === Number(selectedVenueId))) {
      setSelectedVenueId(null);
    }
  }, [selectedVenueId, venues]);

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
  };

  const selectVenueFromMap = (venue) => {
    setSelectedVenueId(venue.id);
    setDetailTab('overview');
    setMapCenter([venue.latitude, venue.longitude]);
    setMapZoom(15);
  };

  return (
    <div className="city-map-page">
      <header className="city-map-page-head">
        <div>
          <p>Smart City Discovery</p>
          <h1>City map explorer</h1>
          <span>Ward boundaries, approved venues, live filtering, and venue details in one map workspace.</span>
        </div>
        <button type="button" onClick={() => navigate(APP_ROUTES.HOME)}>
          Back to Home
        </button>
      </header>

      <section className="city-map-workspace">
        <div className="city-map-main">
          <div className="city-map-filter-panel" role="region" aria-label="Map filters">
            <h2>Find places</h2>
            <p>Filter by Place Categories, Ward Naming, and Services Offered.</p>

            <label className="city-map-search-field">
              <span>Search</span>
              <input
                type="text"
                value={searchInput}
                placeholder="Venue name, address, ward, or service"
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
                {categoryOptions.map((category) => {
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
                {wardOptions.map((ward) => {
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
                {serviceOptions.map((service) => {
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
              <button type="button" className="apply" onClick={applyFilters}>Apply filters</button>
              <button type="button" className="clear" onClick={clearFilters}>Clear</button>
            </div>
          </div>

          <div className="city-map-canvas">
            <MapContainer center={mapCenter} zoom={mapZoom} preferCanvas style={{ height: '100%', width: '100%' }}>
              <MapViewportController center={mapCenter} zoom={mapZoom} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              />

              {wardOptions.map((ward) => {
                const isActive = appliedWardIds.length
                  ? appliedWardIds.includes(String(ward.ward_id))
                  : false;

                return (
                  <GeoJSON
                    key={ward.ward_id}
                    data={ward.boundary}
                    style={{
                      color: isActive ? '#c2410c' : '#2f6e79',
                      weight: isActive ? 2.5 : 1.5,
                      fillColor: isActive ? '#f59e0b' : '#7ab2ba',
                      fillOpacity: isActive ? 0.14 : 0.07,
                    }}
                  >
                    {shouldRenderWardTooltips ? (
                      <Tooltip sticky direction="center">
                        <span className="city-map-ward-label">{ward.name}</span>
                      </Tooltip>
                    ) : null}
                  </GeoJSON>
                );
              })}

              {venues.map((venue) => {
                const categoryId = resolveVenueCategoryId(venue);
                const markerIcon = buildCategoryIcon(categoryId || venue.id, categoryById.get(categoryId)?.icon);

                return (
                  <Marker
                    key={`city-map-venue-${venue.id}`}
                    position={[venue.latitude, venue.longitude]}
                    icon={markerIcon}
                    eventHandlers={{ click: () => selectVenueFromMap(venue) }}
                  >
                    <Popup>
                      <div className="city-map-popup">
                        <img src={resolveVenuePopupImage(venue)} alt={resolveVenueName(venue)} className="city-map-popup-image" loading="lazy" />
                        <strong>{resolveVenueName(venue)}</strong>
                        <span>{venue.address || 'Address not available'}</span>
                        <span>{resolveWardName(venue)} • {resolveVenueCategoryName(venue)}</span>
                        <span>{renderStars(resolveVenueRating(venue))}</span>
                        <button type="button" onClick={() => selectVenueFromMap(venue)}>
                          View full details
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

            <div className="city-map-floating-stats">
              <span>{wardOptions.length} wards</span>
              <span>{venues.length} venues</span>
              <span>{currentPosition ? 'Location enabled' : 'Location unavailable'}</span>
            </div>

            {loading || venuesLoading ? <div className="city-map-overlay">Loading map data...</div> : null}
            {!loading && !venuesLoading && error ? <div className="city-map-overlay is-error">{error}</div> : null}
          </div>
        </div>

        <aside className="city-map-detail-panel">
          {!selectedVenue ? (
            <div className="city-map-detail-empty">
              <h2>Venue detail panel</h2>
              <p>Click any venue marker on the map to open full details here.</p>
            </div>
          ) : (
            <div className="city-map-detail-content">
              <header>
                <h2>{resolveVenueName(selectedVenue)}</h2>
                <p>{renderStars(resolveVenueRating(selectedVenue))}</p>
                <span>{selectedVenue.address || 'Address not available'}</span>
              </header>

              <div className="city-map-detail-tabs">
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
              </div>

              {detailTab === 'overview' ? (
                <ul className="city-map-detail-meta">
                  <li>Ward: {resolveWardName(selectedVenue)}</li>
                  <li>Category: {resolveVenueCategoryName(selectedVenue)}</li>
                  <li>Phone: {selectedVenue.phone || 'Not provided'}</li>
                  <li>Email: {extractVenueEmail(selectedVenue)}</li>
                  <li>Price range: {formatPriceRange(selectedVenue)}</li>
                </ul>
              ) : null}

              {detailTab === 'photos' ? (
                selectedVenueImages.length ? (
                  <div className="city-map-photo-grid">
                    {selectedVenueImages.map((image, index) => (
                      <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer">
                        <img src={image} alt={`${resolveVenueName(selectedVenue)} ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="city-map-empty-note">No photos uploaded for this venue.</p>
                )
              ) : null}

              {detailTab === 'introduction' ? (
                <div className="city-map-introduction">
                  <strong>Description</strong>
                  <p>{selectedVenue.description || 'No introduction provided.'}</p>

                  <strong>Services offered</strong>
                  {selectedVenueServices.length ? (
                    <div className="city-map-service-list">
                      {selectedVenueServices.map((serviceName) => (
                        <span key={serviceName}>{serviceName}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="city-map-empty-note">No services selected by merchant.</p>
                  )}

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
                    <p className="city-map-empty-note">Opening hours not provided.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default CityMapPage;

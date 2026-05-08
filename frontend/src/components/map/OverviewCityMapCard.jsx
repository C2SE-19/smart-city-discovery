import { memo, useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { APP_ROUTES } from '../../constants/routes';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import { fetchVenues } from '../../services/api/venuesApi';
import { fetchWards } from '../../services/api/wardsApi';
import {
  DEFAULT_CITY_CENTER,
  mapCenterFromWards,
  normalizeWards,
  normalizeVenues,
  resolveVenueCategoryId,
  resolveVenueCategoryName,
  resolveVenueName,
  resolveVenueRating,
  resolveWardName,
} from './cityMapUtils';
import './OverviewCityMapCard.css';

const markerCache = new Map();

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
        className: 'overview-city-pin',
        html: `<span style="background:${color}">${normalizedEmoji}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
    );
  }

  return markerCache.get(cacheKey);
}

const userLocationIcon = L.divIcon({
  className: 'overview-city-user-pin',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function renderStars(rating) {
  if (rating === null) {
    return 'No ratings yet';
  }

  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)} ${rating.toFixed(1)}`;
}

function resolveVenuePopupImage(venue) {
  const candidates = [venue?.cover_image_url, venue?.coverImageUrl, venue?.image];

  for (const candidate of candidates) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    if (normalized) {
      return normalized;
    }
  }

  return FALLBACK_VENUE_IMAGE;
}

const OverviewWardLayer = memo(function OverviewWardLayer({ wards }) {
  return wards.map((ward) => (
    <GeoJSON
      key={ward.ward_id}
      data={ward.boundary}
      style={{ color: '#2f6e79', weight: 1.6, fillColor: '#70a4ac', fillOpacity: 0.08 }}
    />
  ));
});

const OverviewVenueLayer = memo(function OverviewVenueLayer({ venues, categoryIconById, currentPosition }) {
  return (
    <>
      {venues.map((venue) => {
        const categoryId = resolveVenueCategoryId(venue);
        const icon = buildCategoryIcon(categoryId || venue.id, categoryIconById.get(categoryId));

        return (
          <Marker key={`overview-map-${venue.id}`} position={[venue.latitude, venue.longitude]} icon={icon}>
            <Popup>
              <div className="overview-city-popup">
                <img
                  src={resolveVenuePopupImage(venue)}
                  alt={resolveVenueName(venue)}
                  className="overview-city-popup-image"
                  loading="lazy"
                />
                <strong>{resolveVenueName(venue)}</strong>
                <span>{venue.address || 'Address not available'}</span>
                <span>{resolveWardName(venue)} • {resolveVenueCategoryName(venue)}</span>
                <span>{renderStars(resolveVenueRating(venue))}</span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {currentPosition ? (
        <Marker position={currentPosition} icon={userLocationIcon}>
          <Popup>
            <div className="overview-city-popup">
              <strong>Your current location</strong>
            </div>
          </Popup>
        </Marker>
      ) : null}
    </>
  );
});

function OverviewCityMapCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wards, setWards] = useState([]);
  const [venues, setVenues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadMapData() {
      setLoading(true);
      setError('');

      try {
        const [wardData, venueData] = await Promise.all([
          fetchWards(),
          fetchVenues({ status: 'approved', compact: 'true', limit: 200 }),
        ]);

        if (!mounted) {
          return;
        }

        setWards(normalizeWards(wardData));
        setVenues(normalizeVenues(venueData));
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(loadError.response?.data?.message || 'Could not load city map data right now.');
        setWards([]);
        setVenues([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMapData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        const categoryData = await fetchPlaceCategories();

        if (!mounted) {
          return;
        }

        setCategories(Array.isArray(categoryData) ? categoryData : []);
      } catch {
        if (mounted) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

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

  const categoryIconById = useMemo(
    () =>
      new Map(
        categories.map((category) => [Number(category.id), category.icon || '📍'])
      ),
    [categories]
  );

  const mapCenter = useMemo(() => mapCenterFromWards(wards), [wards]);
  const previewVenues = useMemo(() => venues.slice(0, 200), [venues]);
  const handleOpenLargeMap = () => {
    const params = new URLSearchParams();
    params.set('lat', String(Number(DEFAULT_CITY_CENTER[0])));
    params.set('lng', String(Number(DEFAULT_CITY_CENTER[1])));
    params.set('mapZoom', '13');
    navigate(`${APP_ROUTES.CITY_MAP}?${params.toString()}`);
  };

  return (
    <div className="overview-city-shell">
      <div className="overview-city-toolbar">
        <span>{wards.length} wards</span>
        <span>{venues.length} approved venues</span>
        <span>Previewing {previewVenues.length} markers for fast load</span>
        <span>Read-only city map</span>
      </div>

      <div className="overview-city-canvas">
        <MapContainer
          center={mapCenter || DEFAULT_CITY_CENTER}
          zoom={12}
          preferCanvas
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />

          <OverviewWardLayer wards={wards} />
          <OverviewVenueLayer
            venues={previewVenues}
            categoryIconById={categoryIconById}
            currentPosition={currentPosition}
          />
        </MapContainer>

        {loading ? <div className="overview-city-overlay">Loading city map...</div> : null}
        {!loading && error ? <div className="overview-city-overlay is-error">{error}</div> : null}
      </div>

      <button
        type="button"
        className="overview-city-link"
        onClick={handleOpenLargeMap}
      >
        View larger map
      </button>
    </div>
  );
}

export default memo(OverviewCityMapCard);

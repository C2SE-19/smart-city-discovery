import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWards } from '../../../services/api/wardsApi';
import './LocationPickerModal.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_LOCATION = { lat: 16.0471, lng: 108.2068 };
const DEFAULT_ZOOM = 13;
const PICKED_LOCATION_ZOOM = 17;

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

const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = defaultMarkerIcon;

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    }
  });

  return null;
}

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
      return;
    }

    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
}

function LocationPickerModal({ isOpen, onClose, onLocationSelect, defaultLocation = null }) {
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation || DEFAULT_LOCATION);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [wardLoadError, setWardLoadError] = useState('');

  const defaultLocationLatitude = Number(defaultLocation?.lat);
  const defaultLocationLongitude = Number(defaultLocation?.lng);
  const hasDefaultLocation = Number.isFinite(defaultLocationLatitude) && Number.isFinite(defaultLocationLongitude);

  const defaultCenter = useMemo(() => {
    if (hasDefaultLocation) {
      return {
        lat: defaultLocationLatitude,
        lng: defaultLocationLongitude,
      };
    }

    return DEFAULT_LOCATION;
  }, [defaultLocationLatitude, defaultLocationLongitude, hasDefaultLocation]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedLocation(defaultCenter);
    setMapZoom(hasDefaultLocation ? PICKED_LOCATION_ZOOM : DEFAULT_ZOOM);
  }, [isOpen, defaultCenter, hasDefaultLocation]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function loadWards() {
      setLoadingWards(true);
      setWardLoadError('');

      try {
        const wardData = await fetchWards();
        setWards(Array.isArray(wardData) ? wardData : []);
      } catch (error) {
        setWardLoadError(error.response?.data?.message || 'Could not load ward boundaries for map preview.');
      } finally {
        setLoadingWards(false);
      }
    }

    loadWards();
  }, [isOpen]);

  const handleMapClick = (latlng) => {
    setSelectedLocation({
      lat: latlng.lat,
      lng: latlng.lng
    });
    setMapZoom(PICKED_LOCATION_ZOOM);
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLocation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content location-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Pick Venue Location</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="map-container">
            <div className="map-instruction">Click anywhere on the map to pin your venue location.</div>

            <MapContainer
              center={[defaultCenter.lat, defaultCenter.lng]}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <MapViewportController center={selectedLocation} zoom={mapZoom} />

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
                      color: '#155e63',
                      weight: 2,
                      fillOpacity: 0.08,
                    }}
                  >
                    <Tooltip sticky>
                      <span>{ward.name}</span>
                    </Tooltip>
                  </GeoJSON>
                );
              })}

              <MapClickHandler onMapClick={handleMapClick} />

              {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lng]} />}
            </MapContainer>
          </div>

          <div className="map-info">
            <div className="coordinate-display">
              <div className="coordinate-item">
                <span className="coordinate-label">Latitude</span>
                <span className="coordinate-value">{selectedLocation?.lat?.toFixed(6) || ''}</span>
              </div>

              <div className="coordinate-item">
                <span className="coordinate-label">Longitude</span>
                <span className="coordinate-value">{selectedLocation?.lng?.toFixed(6) || ''}</span>
              </div>
            </div>

            {loadingWards ? <p className="ward-load-note">Loading ward boundaries...</p> : null}
            {wardLoadError ? <p className="ward-load-error">{wardLoadError}</p> : null}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-btn modal-btn-confirm" onClick={handleConfirm}>
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPickerModal;

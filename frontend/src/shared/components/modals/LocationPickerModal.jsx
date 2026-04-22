import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Pane, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWards } from '../../../services/api/wardsApi';
import { detectWardRequest, geocodeVenueAddress } from '../../../services/api/venuesApi';
import './LocationPickerModal.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_LOCATION = { lat: 16.0471, lng: 108.2068 };
const DEFAULT_ZOOM = 13;
const SELECTED_WARD_ZOOM = 14;
const PICKED_LOCATION_ZOOM = 17;

function stripLeadingHouseNumber(addressQuery) {
  return String(addressQuery || '')
    .replace(/^\s*\d+[a-zA-Z]?(?:[/-]\d+[a-zA-Z]?)?\s*/u, '')
    .trim();
}

function normalizeBoundaryInput(boundary) {
  if (!boundary) {
    return null;
  }

  if (typeof boundary === 'string') {
    try {
      return JSON.parse(boundary);
    } catch {
      return null;
    }
  }

  return typeof boundary === 'object' ? boundary : null;
}

function toPolygonBoundaryFeatureCollection(boundary) {
  const normalizedBoundary = normalizeBoundaryInput(boundary);

  if (!normalizedBoundary || typeof normalizedBoundary !== 'object') {
    return null;
  }

  const features =
    normalizedBoundary.type === 'FeatureCollection' && Array.isArray(normalizedBoundary.features)
      ? normalizedBoundary.features
      : normalizedBoundary.type === 'Feature'
        ? [normalizedBoundary]
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

function visitCoordinatePairs(coordinates, onPair) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    onPair(coordinates);
    return;
  }

  coordinates.forEach((nested) => visitCoordinatePairs(nested, onPair));
}

function getBoundaryCenter(boundaryFeatureCollection) {
  if (!boundaryFeatureCollection || boundaryFeatureCollection.type !== 'FeatureCollection') {
    return null;
  }

  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let hasPoint = false;

  boundaryFeatureCollection.features.forEach((feature) => {
    const geometry = feature?.geometry;
    visitCoordinatePairs(geometry?.coordinates, (pair) => {
      const longitude = Number(pair[0]);
      const latitude = Number(pair[1]);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      hasPoint = true;
      minLatitude = Math.min(minLatitude, latitude);
      maxLatitude = Math.max(maxLatitude, latitude);
      minLongitude = Math.min(minLongitude, longitude);
      maxLongitude = Math.max(maxLongitude, longitude);
    });
  });

  if (!hasPoint) {
    return null;
  }

  return {
    lat: (minLatitude + maxLatitude) / 2,
    lng: (minLongitude + maxLongitude) / 2,
  };
}

function isPointOnSegment(point, segmentStart, segmentEnd) {
  const tolerance = 1e-10;
  const [pointX, pointY] = point;
  const [x1, y1] = segmentStart;
  const [x2, y2] = segmentEnd;

  const cross = (pointY - y1) * (x2 - x1) - (pointX - x1) * (y2 - y1);
  if (Math.abs(cross) > tolerance) {
    return false;
  }

  const dot = (pointX - x1) * (x2 - x1) + (pointY - y1) * (y2 - y1);
  if (dot < -tolerance) {
    return false;
  }

  const squaredLength = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (dot - squaredLength > tolerance) {
    return false;
  }

  return true;
}

function isPointInLinearRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (!Array.isArray(current) || !Array.isArray(previous)) {
      continue;
    }

    const currentX = Number(current[0]);
    const currentY = Number(current[1]);
    const previousX = Number(previous[0]);
    const previousY = Number(previous[1]);

    if (
      !Number.isFinite(currentX) ||
      !Number.isFinite(currentY) ||
      !Number.isFinite(previousX) ||
      !Number.isFinite(previousY)
    ) {
      continue;
    }

    if (isPointOnSegment(point, [currentX, currentY], [previousX, previousY])) {
      return true;
    }

    const intersects =
      (currentY > point[1]) !== (previousY > point[1]) &&
      point[0] < ((previousX - currentX) * (point[1] - currentY)) / (previousY - currentY) + currentX;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInPolygonCoordinates(point, polygonCoordinates) {
  if (!Array.isArray(polygonCoordinates) || !polygonCoordinates.length) {
    return false;
  }

  const outerRing = polygonCoordinates[0];
  if (!isPointInLinearRing(point, outerRing)) {
    return false;
  }

  for (let holeIndex = 1; holeIndex < polygonCoordinates.length; holeIndex += 1) {
    if (isPointInLinearRing(point, polygonCoordinates[holeIndex])) {
      return false;
    }
  }

  return true;
}

function isPointInsideBoundary(latlng, boundaryFeatureCollection) {
  if (!latlng || !boundaryFeatureCollection || boundaryFeatureCollection.type !== 'FeatureCollection') {
    return false;
  }

  const point = [Number(latlng.lng), Number(latlng.lat)];

  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    return false;
  }

  return boundaryFeatureCollection.features.some((feature) => {
    const geometry = feature?.geometry;

    if (!geometry || !Array.isArray(geometry.coordinates)) {
      return false;
    }

    if (geometry.type === 'Polygon') {
      return isPointInPolygonCoordinates(point, geometry.coordinates);
    }

    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some((polygonCoordinates) =>
        isPointInPolygonCoordinates(point, polygonCoordinates)
      );
    }

    return false;
  });
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

function LocationPickerModal({
  isOpen,
  onClose,
  onLocationSelect,
  defaultLocation = null,
  selectedWardId = '',
  initialAddressQuery = ''
}) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_LOCATION);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [wardLoadError, setWardLoadError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [addressResolveMessage, setAddressResolveMessage] = useState('');

  const defaultLocationLatitude = Number(defaultLocation?.lat);
  const defaultLocationLongitude = Number(defaultLocation?.lng);
  const hasDefaultLocation = Number.isFinite(defaultLocationLatitude) && Number.isFinite(defaultLocationLongitude);
  const normalizedSelectedWardId = String(selectedWardId || '').trim();

  const defaultCenter = useMemo(() => {
    if (hasDefaultLocation) {
      return {
        lat: defaultLocationLatitude,
        lng: defaultLocationLongitude,
      };
    }

    return DEFAULT_LOCATION;
  }, [defaultLocationLatitude, defaultLocationLongitude, hasDefaultLocation]);

  const wardsWithBoundaries = useMemo(
    () =>
      wards
        .map((ward) => ({
          ...ward,
          boundary: toPolygonBoundaryFeatureCollection(ward.boundary),
        }))
        .filter((ward) => ward.boundary),
    [wards]
  );

  const selectedWard = useMemo(() => {
    if (!normalizedSelectedWardId) {
      return null;
    }

    return (
      wardsWithBoundaries.find((ward) => String(ward.ward_id) === normalizedSelectedWardId) || null
    );
  }, [normalizedSelectedWardId, wardsWithBoundaries]);

  const selectedWardCenter = useMemo(
    () => (selectedWard ? getBoundaryCenter(selectedWard.boundary) : null),
    [selectedWard]
  );

  const allowedBoundaries = useMemo(() => {
    if (selectedWard?.boundary) {
      return [selectedWard.boundary];
    }

    return wardsWithBoundaries.map((ward) => ward.boundary);
  }, [selectedWard, wardsWithBoundaries]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedLocation(null);
    setMapCenter(selectedWardCenter || defaultCenter);
    setMapZoom(selectedWardCenter ? SELECTED_WARD_ZOOM : hasDefaultLocation ? PICKED_LOCATION_ZOOM : DEFAULT_ZOOM);
    setSelectionError('');
    setAddressResolveMessage('');
    setIsValidatingLocation(false);
    setIsResolvingAddress(false);
  }, [isOpen, hasDefaultLocation, defaultCenter, selectedWardCenter]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const normalizedAddressQuery = String(initialAddressQuery || '').trim();
    if (!normalizedAddressQuery) {
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    const resolveAddressToMapPoint = async () => {
      setIsResolvingAddress(true);
      setAddressResolveMessage('Searching map position from entered address...');

      try {
        const normalizedAddressWithoutHouseNumber = stripLeadingHouseNumber(normalizedAddressQuery);
        const geocodeAttempts = [
          {
            addressQuery: normalizedAddressQuery,
            wardId: normalizedSelectedWardId || null
          }
        ];

        if (
          normalizedAddressWithoutHouseNumber &&
          normalizedAddressWithoutHouseNumber !== normalizedAddressQuery
        ) {
          geocodeAttempts.push({
            addressQuery: normalizedAddressWithoutHouseNumber,
            wardId: normalizedSelectedWardId || null
          });
        }

        if (normalizedSelectedWardId) {
          geocodeAttempts.push({
            addressQuery: normalizedAddressQuery,
            wardId: null
          });

          if (
            normalizedAddressWithoutHouseNumber &&
            normalizedAddressWithoutHouseNumber !== normalizedAddressQuery
          ) {
            geocodeAttempts.push({
              addressQuery: normalizedAddressWithoutHouseNumber,
              wardId: null
            });
          }
        }

        const dedupedAttempts = geocodeAttempts.filter((attempt, index, source) => {
          const attemptKey = `${attempt.addressQuery}::${attempt.wardId || ''}`;
          return source.findIndex((item) => `${item.addressQuery}::${item.wardId || ''}` === attemptKey) === index;
        });

        let geocoded = null;
        let lastGeocodeError = null;

        for (const attempt of dedupedAttempts) {
          try {
            const nextResult = await geocodeVenueAddress(attempt, {
              signal: abortController.signal,
              timeout: 6500,
            });
            geocoded = nextResult;
            break;
          } catch (attemptError) {
            lastGeocodeError = attemptError;

            if (attemptError?.code === 'ERR_CANCELED') {
              return;
            }

            const attemptStatusCode = Number(attemptError?.response?.status) || 0;
            if (attemptStatusCode === 429) {
              break;
            }
          }
        }

        if (!geocoded) {
          throw lastGeocodeError || new Error('Unable to geocode address');
        }

        if (!isMounted) {
          return;
        }

        const latitude = Number(geocoded?.latitude ?? geocoded?.lat);
        const longitude = Number(geocoded?.longitude ?? geocoded?.lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setAddressResolveMessage('Could not locate this address. Please click directly on the map.');
          return;
        }

        const nextLocation = { lat: latitude, lng: longitude };
        const isWithinAllowedBoundary =
          !allowedBoundaries.length ||
          allowedBoundaries.some((boundary) => isPointInsideBoundary(nextLocation, boundary));

        const isFallback = Boolean(geocoded?.isFallbackLocation);

        setSelectedLocation(nextLocation);
        setMapCenter(nextLocation);
        setMapZoom(PICKED_LOCATION_ZOOM);
        setSelectionError('');
        const hasExactHouseNumberMatch = Boolean(geocoded?.exactHouseNumberMatched);
        const detectedWardName = String(geocoded?.wardName || geocoded?.ward_name || '').trim();
        const selectedWardName = String(selectedWard?.name || '').trim();
        
        let messageText = hasExactHouseNumberMatch
          ? 'Address found. Map moved to the exact location.'
          : 'Address found at street level. Please fine-tune the pin if house number is not exact.';
        
        if (isFallback) {
          if (selectedWardName && detectedWardName) {
            messageText += ` (⚠️ You selected ${selectedWardName}, but this address is in ${detectedWardName}.)`;
          } else if (detectedWardName) {
            messageText += ` (⚠️ This address is in ${detectedWardName}, outside the selected ward.)`;
          } else {
            messageText += ' (⚠️ Location is approximate - found outside selected ward area)';
          }
        }

        if (!isWithinAllowedBoundary && !isFallback) {
          if (selectedWardName) {
            messageText += ` (⚠️ Address found outside ${selectedWardName}. You can still inspect this point, then adjust ward/address or pick manually.)`;
          } else {
            messageText += ' (⚠️ Address found outside available ward boundaries. Please fine-tune manually.)';
          }
        }
        
        setAddressResolveMessage(messageText);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error?.code === 'ERR_CANCELED') {
          return;
        }

        setAddressResolveMessage(
          error?.response?.data?.message ||
            'Could not geocode the entered address. Please click directly on the map.'
        );
      } finally {
        if (isMounted) {
          setIsResolvingAddress(false);
        }
      }

    };

    resolveAddressToMapPoint();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [
    allowedBoundaries,
    initialAddressQuery,
    isOpen,
    normalizedSelectedWardId,
    selectedWard
  ]);

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

  const handleMapClick = async (latlng) => {
    if (isValidatingLocation) {
      return;
    }

    if (!normalizedSelectedWardId) {
      setSelectionError('Select a ward before picking location on map.');
      return;
    }

    if (!allowedBoundaries.length) {
      setSelectionError('Ward boundaries are not available. Please try again in a moment.');
      return;
    }

    const isWithinAllowedBoundary = allowedBoundaries.some((boundary) => isPointInsideBoundary(latlng, boundary));

    if (!isWithinAllowedBoundary) {
      setSelectionError(
        selectedWard
          ? `You can only pin a location inside ${selectedWard.name}.`
          : 'You can only pin a location inside ward boundaries.'
      );
      return;
    }

    setIsValidatingLocation(true);

    try {
      const detection = await detectWardRequest({ latitude: latlng.lat, longitude: latlng.lng });
      const detectedWardId = String(detection?.wardId || detection?.ward_id || '').trim();

      if (!detectedWardId) {
        setSelectionError('You can only pin a location inside ward boundaries.');
        return;
      }

      if (detectedWardId !== normalizedSelectedWardId) {
        setSelectionError(
          selectedWard
            ? `You can only pin a location inside ${selectedWard.name}.`
            : 'Selected location does not belong to the chosen ward.'
        );
        return;
      }

      setSelectedLocation({
        lat: latlng.lat,
        lng: latlng.lng
      });
      setMapZoom(PICKED_LOCATION_ZOOM);
      setSelectionError('');
    } catch {
      setSelectionError('Could not validate this location. Please try again.');
    } finally {
      setIsValidatingLocation(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLocation || isValidatingLocation) {
      return;
    }

    if (!normalizedSelectedWardId) {
      setSelectionError('Select a ward before confirming location.');
      return;
    }

    setIsValidatingLocation(true);

    try {
      const detection = await detectWardRequest({
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      });

      const detectedWardId = String(detection?.wardId || detection?.ward_id || '').trim();
      if (!detectedWardId || detectedWardId !== normalizedSelectedWardId) {
        setSelectionError(
          selectedWard
            ? `Selected point is outside ${selectedWard.name}. Please pick again.`
            : 'Selected point is outside ward boundaries. Please pick again.'
        );
        return;
      }

      onLocationSelect(selectedLocation);
      onClose();
    } catch {
      setSelectionError('Could not validate selected location. Please try again.');
    } finally {
      setIsValidatingLocation(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay location-picker-overlay" onClick={onClose}>
      <div className="modal-content location-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Pick Venue Location</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="map-container">
            <div className="map-instruction">
              {selectedWard
                ? `Click inside ${selectedWard.name} to pin your venue location.`
                : 'Click inside ward boundaries to pin your venue location.'}
            </div>

            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <MapViewportController center={selectedLocation || mapCenter} zoom={mapZoom} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              />

              <Pane name="location-picker-road-labels" style={{ zIndex: 460, pointerEvents: 'none' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                />
              </Pane>

              {wardsWithBoundaries.map((ward) => {
                const isSelectedWard =
                  Boolean(selectedWard) && String(ward.ward_id) === String(selectedWard.ward_id);

                return (
                  <GeoJSON
                    key={`${ward.ward_id}-${ward.updated_at || ward.created_at || ''}`}
                    data={ward.boundary}
                    style={{
                      color: isSelectedWard ? '#2e8f96' : '#155e63',
                      weight: isSelectedWard ? 2.5 : 2,
                      fillColor: isSelectedWard ? '#bde6e9' : '#155e63',
                      fillOpacity: isSelectedWard ? 0.22 : selectedWard ? 0.04 : 0.08,
                    }}
                  >
                    <Tooltip sticky>
                      <span>{ward.name}{isSelectedWard ? ' (selected)' : ''}</span>
                    </Tooltip>
                  </GeoJSON>
                );
              })}

              <MapClickHandler onMapClick={handleMapClick} />

              {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lng]} />}
            </MapContainer>
          </div>

          <div className="map-info">
            {selectedWard ? <p className="selected-ward-note">Selected ward: {selectedWard.name}</p> : null}
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
            {isResolvingAddress ? <p className="ward-load-note">Finding location from entered address...</p> : null}
            {isValidatingLocation ? <p className="ward-load-note">Validating selected location...</p> : null}
            {wardLoadError ? <p className="ward-load-error">{wardLoadError}</p> : null}
            {addressResolveMessage ? <p className="map-geocode-note">{addressResolveMessage}</p> : null}
            {selectionError ? <p className="map-selection-error">{selectionError}</p> : null}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={handleConfirm}
            disabled={!selectedLocation || isValidatingLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPickerModal;

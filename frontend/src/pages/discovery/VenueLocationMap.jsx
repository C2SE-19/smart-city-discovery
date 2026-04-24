import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import './VenueLocationMap.css';

export default function VenueLocationMap({
  venue = {},
  address = '',
  latitude = null,
  longitude = null,
  weeklySchedule = [],
  currentStatusText = '',
  isOpenNow = false,
  labels = {},
  onOpenInternalMap = () => {}
}) {
  const venueName = String(venue.name || venue.title || 'Venue').trim();
  const venueAddress = String(address || venue.address || 'No address').trim();
  
  // Map center
  const mapCenter = useMemo(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return [latitude, longitude];
    }
    return [16.0609, 108.2332]; // Default Da Nang center
  }, [latitude, longitude]);

  // Custom red marker
  const redMarkerIcon = useMemo(() => {
    return L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }, []);

  // Format schedule
  const formatSchedule = (schedule) => {
    if (!schedule) return 'N/A';
    const open = String(schedule.open || 'N/A').trim();
    const close = String(schedule.close || 'N/A').trim();
    return `${open} - ${close}`;
  };

  const today = new Date().getDay(); // 0 = Sunday
  const todayIndex = (today + 6) % 7; // shift to Monday=0
  const WEEK_DAYS = Array.isArray(labels.weekDays) && labels.weekDays.length === 7
    ? labels.weekDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const titleText = labels.title || '📍 Location & Hours';
  const openingHoursText = labels.openingHours || '⏰ Opening Hours';
  const noScheduleText = labels.noSchedule || 'No schedule available';
  const addressLabelText = labels.addressLabel || 'Đây là địa chỉ của quán';
  const addressFallbackText = labels.addressFallback || 'Chưa cập nhật địa chỉ';
  const openMapTitle = labels.openMapTitle || 'Mở trên bản đồ Smart City';

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return (
    <section className="venue-location-map-section">
      <div className="venue-location-header">
        <h3>{titleText}</h3>
      </div>

      <div className="venue-location-content">
        {/* Map */}
        <div className="venue-location-map-column">
          <div className="venue-map-container">
            <MapContainer center={mapCenter} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={mapCenter} icon={redMarkerIcon}>
                <Popup>
                  <div className="venue-map-popup">
                    <strong>{venueName}</strong>
                    <p>{venueAddress}</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          <button
            type="button"
            className="venue-location-address-card"
            onClick={onOpenInternalMap}
            title={openMapTitle}
          >
            <span className="venue-location-address-card-label">{addressLabelText}</span>
            <span className="venue-location-address-card-value">📍 {venueAddress || addressFallbackText}</span>
          </button>
        </div>

        {/* Location Info */}
        <div className="venue-location-info">
          <div className="venue-location-meta">
            <strong className="venue-location-name">{venueName}</strong>
          </div>

          {/* Opening Hours */}
          <div className="venue-location-hours">
            <h4 className="venue-hours-title">{openingHoursText}</h4>
            <div className="venue-hours-list">
              {Array.isArray(weeklySchedule) && weeklySchedule.length > 0 ? (
                weeklySchedule.map((schedule, idx) => (
                  <div key={idx} className={`venue-hour-item ${idx === todayIndex ? 'is-today' : ''}`}>
                    <span className="venue-day-meta">
                      <span className="venue-day-name">{WEEK_DAYS[idx]}</span>
                      {idx === todayIndex && currentStatusText ? (
                        <span className={`venue-open-status ${isOpenNow ? 'is-open' : 'is-closed'}`}>
                          {currentStatusText}
                        </span>
                      ) : null}
                    </span>
                    <span className="venue-hour-time">{formatSchedule(schedule)}</span>
                  </div>
                ))
              ) : (
                <p className="venue-hours-empty">{noScheduleText}</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}


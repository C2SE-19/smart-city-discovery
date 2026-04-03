import { useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import MapClickHandler from './MapClickHandler';

const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = defaultMarkerIcon;

function resolveVenueWardName(venue) {
  return venue.ward_name || venue.wardName || venue.ward || 'Chua gan phuong';
}

function InteractiveWardMap({
  wards,
  venues,
  loading,
  saving,
  selectedWardName = '',
  allowPinCreation = false,
  onCreateVenue,
  lastCreatedVenue,
  emptyLabel = 'Dang doi du lieu GIS tu backend.'
}) {
  const [draftPin, setDraftPin] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [localError, setLocalError] = useState('');

  const visibleVenues = venues.filter((venue) => {
    if (!selectedWardName) {
      return true;
    }

    return resolveVenueWardName(venue) === selectedWardName;
  });

  async function handleSaveVenue() {
    if (!draftPin || !onCreateVenue) {
      return;
    }

    setLocalError('');

    try {
      await onCreateVenue({
        name: draftName || 'Dia diem chua dat ten',
        address: draftAddress || 'Chua co dia chi',
        latitude: draftPin.lat,
        longitude: draftPin.lng
      });

      setDraftPin(null);
      setDraftName('');
      setDraftAddress('');
    } catch (error) {
      setLocalError(error.response?.data?.error || error.message || 'Khong luu duoc dia diem.');
    }
  }

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <span className="map-badge">{wards.length} wards</span>
        <span className="map-badge">{visibleVenues.length} venues</span>
        <span className="map-badge">{allowPinCreation ? 'Pin enabled' : 'Preview mode'}</span>
      </div>

      {lastCreatedVenue?.detectedWard ? (
        <div className="map-save-banner">
          Venue moi da duoc gan vao phuong <strong>{lastCreatedVenue.detectedWard}</strong>.
        </div>
      ) : null}

      {localError ? <div className="map-error-banner">{localError}</div> : null}

      <div className="map-canvas">
        <MapContainer center={[16.035, 108.218]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <MapClickHandler disabled={!allowPinCreation} onMapClick={setDraftPin} />

          {wards.map((ward) => {
            const isSelected = selectedWardName && ward.name === selectedWardName;

            return (
              <GeoJSON
                key={ward.ward_id}
                data={ward.boundary}
                style={{
                  color: isSelected ? '#f25f29' : '#155e63',
                  weight: isSelected ? 3 : 2,
                  fillOpacity: isSelected ? 0.2 : 0.08
                }}
              >
                <Tooltip permanent direction="center">
                  <span className="map-tooltip-label">{ward.name}</span>
                </Tooltip>
              </GeoJSON>
            );
          })}

          {visibleVenues.map((venue) => (
            <Marker key={venue.id || `${venue.latitude}-${venue.longitude}-${venue.name}`} position={[venue.latitude, venue.longitude]}>
              <Popup>
                <div className="map-popup-copy">
                  <strong>{venue.name}</strong>
                  <span>{venue.address}</span>
                  <span>{resolveVenueWardName(venue)}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {allowPinCreation && draftPin ? (
            <Marker position={[draftPin.lat, draftPin.lng]}>
              <Popup>
                <div className="map-popup-form">
                  <strong>Tao venue moi</strong>
                  <input
                    className="map-popup-input"
                    type="text"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Ten quan"
                  />
                  <input
                    className="map-popup-input"
                    type="text"
                    value={draftAddress}
                    onChange={(event) => setDraftAddress(event.target.value)}
                    placeholder="Dia chi"
                  />
                  <button className="map-popup-button" disabled={saving} onClick={handleSaveVenue} type="button">
                    {saving ? 'Dang luu...' : 'Luu va gan phuong'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ) : null}
        </MapContainer>

        {loading ? <div className="map-overlay">Dang tai du lieu ban do...</div> : null}
        {!loading && wards.length === 0 ? <div className="map-overlay">{emptyLabel}</div> : null}
      </div>
    </div>
  );
}

export default InteractiveWardMap;
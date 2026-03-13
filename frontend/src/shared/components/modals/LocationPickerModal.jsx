import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationPickerModal.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

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

function LocationPickerModal({ isOpen, onClose, onLocationSelect, defaultLocation = null }) {
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation || { lat: 16.035, lng: 108.218 });

  const handleMapClick = (latlng) => {
    setSelectedLocation({
      lat: latlng.lat,
      lng: latlng.lng
    });
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
          <h2>Select Location on Map</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="map-container">
            <MapContainer center={[selectedLocation.lat || 16.035, selectedLocation.lng || 108.218]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              <MapClickHandler onMapClick={handleMapClick} />

              {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lng]} />}
            </MapContainer>
          </div>

          <div className="location-info">
            <div className="location-field">
              <label>Latitude</label>
              <input type="text" value={selectedLocation?.lat?.toFixed(6) || ''} readOnly className="location-input" />
            </div>
            <div className="location-field">
              <label>Longitude</label>
              <input type="text" value={selectedLocation?.lng?.toFixed(6) || ''} readOnly className="location-input" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPickerModal;

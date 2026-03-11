import { useMapEvents } from 'react-leaflet';

function MapClickHandler({ disabled = false, onMapClick }) {
  useMapEvents({
    click(event) {
      if (!disabled) {
        onMapClick(event.latlng);
      }
    }
  });

  return null;
}

export default MapClickHandler;
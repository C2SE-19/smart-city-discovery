import { useState } from 'react';
import '../styles/ServiceSelector.css';

function ServiceSelector({ availableServices = [], onServicesChange, selectedServices = [] }) {
  const [services, setServices] = useState(selectedServices);

  const handleToggleService = (serviceId) => {
    const updated = services.includes(serviceId)
      ? services.filter((id) => id !== serviceId)
      : [...services, serviceId];

    setServices(updated);

    if (onServicesChange) {
      onServicesChange(updated);
    }
  };

  const mockServices = availableServices.length > 0
    ? availableServices
    : [
        { id: 'dine-in', name: 'Dine In', icon: '🪑' },
        { id: 'takeaway', name: 'Takeaway', icon: '🛍️' },
        { id: 'delivery', name: 'Delivery', icon: '🚚' },
        { id: 'outdoor-seating', name: 'Outdoor Seating', icon: '🌳' },
        { id: 'parking', name: 'Parking', icon: '🅿️' },
        { id: 'wifi', name: 'WiFi', icon: '📶' },
        { id: 'live-music', name: 'Live Music', icon: '🎵' },
        { id: 'private-events', name: 'Private Events', icon: '🎉' }
      ];

  return (
    <div className="service-selector">
      <label className="selector-label">Services Offered</label>
      <div className="services-grid">
        {mockServices.map((service) => (
          <button
            key={service.id}
            type="button"
            className={`service-chip ${services.includes(service.id) ? 'active' : ''}`}
            onClick={() => handleToggleService(service.id)}
          >
            <span className="service-icon">{service.icon}</span>
            <span className="service-name">{service.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ServiceSelector;

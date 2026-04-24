import React from 'react';
import './VenueInfoSection.css';

export default function VenueInfoSection({
  description = '',
  services = [],
  showServices = false,
  labels = {},
  resolveServiceIcon = null
}) {
  const aboutTitle = labels.aboutTitle || 'About';
  const noDescriptionText = labels.noDescription || 'No description available for this venue.';
  const servicesTitle = labels.servicesTitle || 'Services Offered';
  const serviceFallbackText = labels.serviceFallback || 'Service';

  return (
    <div className="venue-info-section">
      {/* Description Section */}
      <div className="venue-desc-container">
        <h2>{aboutTitle}</h2>
        <p className="venue-description">
          {description || noDescriptionText}
        </p>
      </div>

      {/* Services Section */}
      {showServices && services && services.length > 0 && (
        <div className="venue-services-container">
          <h2>{servicesTitle}</h2>
          <div className="services-grid">
            {services.map((service, idx) => (
              <div key={idx} className="service-card">
                <div className="service-icon">
                  {(typeof resolveServiceIcon === 'function' ? resolveServiceIcon(service) : '') || service.icon || '✓'}
                </div>
                <div className="service-name">
                  {service.name || serviceFallbackText}
                </div>
                {service.description && (
                  <div className="service-description">
                    {service.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
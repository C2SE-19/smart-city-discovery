import useUserI18n from '../../../hooks/useUserI18n';
import '../styles/ServiceSelector.css';

function normalizeServiceId(value) {
  const numericId = Number(value);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  return numericId;
}

function ServiceSelector({
  availableServices = [],
  onServicesChange,
  selectedServices = [],
  disabled = false,
}) {
  const { tx } = useUserI18n();
  const normalizedSelectedServices = Array.isArray(selectedServices)
    ? [...new Set(selectedServices.map((serviceId) => normalizeServiceId(serviceId)).filter(Boolean))]
    : [];
  const selectedServiceSet = new Set(normalizedSelectedServices);

  const activeServices = Array.isArray(availableServices)
    ? availableServices.filter((service) => normalizeServiceId(service?.id) !== null)
    : [];

  const handleToggleService = (serviceId) => {
    if (disabled) {
      return;
    }

    const normalizedServiceId = normalizeServiceId(serviceId);
    if (normalizedServiceId === null) {
      return;
    }

    const updated = selectedServiceSet.has(normalizedServiceId)
      ? normalizedSelectedServices.filter((id) => id !== normalizedServiceId)
      : [...normalizedSelectedServices, normalizedServiceId];

    const deduplicated = [...new Set(updated)];

    onServicesChange?.(deduplicated);
  };

  return (
    <div className="service-selector">
      <label className="selector-label">{tx('Services Offered')}</label>
      {!activeServices.length ? (
        <p className="service-empty-note">{tx('No services configured by admin yet.')}</p>
      ) : (
        <div className="services-grid">
          {activeServices.map((service) => {
            const serviceId = normalizeServiceId(service.id);
            if (serviceId === null) {
              return null;
            }

            return (
              <button
                key={service.id}
                type="button"
                className={`service-chip ${selectedServiceSet.has(serviceId) ? 'active' : ''}`}
                onClick={() => handleToggleService(serviceId)}
                disabled={disabled}
              >
                <span className="service-name">{service.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ServiceSelector;

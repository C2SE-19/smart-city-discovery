import { useEffect, useState } from 'react';
import ImageUploader from './ImageUploader';
import ServiceSelector from './ServiceSelector';
import BusinessLicenseUploader from './BusinessLicenseUploader';
import LocationPickerModal from '../../../shared/components/modals/LocationPickerModal';
import { createVenueRequest } from '../../../services/api/venuesApi';
import { fetchPlaceCategories } from '../../../services/api/placeCategoriesApi';
import { fetchMerchantServices } from '../../../services/api/merchantServicesApi';
import { fetchWards } from '../../../services/api/wardsApi';
import '../styles/MerchantVenueForm.css';

const WEEK_DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
];

function buildDefaultWeeklyOpenHours() {
  return WEEK_DAYS.reduce((accumulator, day) => {
    accumulator[day.key] = {
      isClosed: false,
      openTime: '',
      closeTime: ''
    };

    return accumulator;
  }, {});
}

function buildDefaultWeeklyOverrideMap() {
  return WEEK_DAYS.reduce((accumulator, day) => {
    accumulator[day.key] = false;
    return accumulator;
  }, {});
}

function MerchantVenueForm() {
  const [activeWeekDay, setActiveWeekDay] = useState(WEEK_DAYS[0].key);
  const [formData, setFormData] = useState({
    venueName: '',
    category: '',
    address: '',
    wardId: '',
    latitude: null,
    longitude: null,
    phone: '',
    minPrice: '',
    maxPrice: '',
    startTime: '',
    endTime: '',
    weeklyOpenHours: buildDefaultWeeklyOpenHours(),
    description: '',
    selectedServices: [],
    images: [],
    businessLicense: null
  });
  const [weeklyManualOverrides, setWeeklyManualOverrides] = useState(buildDefaultWeeklyOverrideMap());

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [placeCategories, setPlaceCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [merchantServices, setMerchantServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceLoadError, setServiceLoadError] = useState('');
  const [wards, setWards] = useState([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [wardLoadError, setWardLoadError] = useState('');
  const [isResubmitLocked, setIsResubmitLocked] = useState(false);

  const handleWeeklyHoursChange = (dayKey, field, value) => {
    unlockResubmitIfNeeded();
    setWeeklyManualOverrides((prev) => ({
      ...prev,
      [dayKey]: true
    }));

    setFormData((prev) => {
      const currentDay = prev.weeklyOpenHours?.[dayKey] || {
        isClosed: false,
        openTime: '',
        closeTime: ''
      };

      const nextDay = {
        ...currentDay,
        [field]: value
      };

      if (field === 'isClosed' && value === true) {
        nextDay.openTime = '';
        nextDay.closeTime = '';
      }

      return {
        ...prev,
        weeklyOpenHours: {
          ...prev.weeklyOpenHours,
          [dayKey]: nextDay
        }
      };
    });

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const activeWeekDayConfig = WEEK_DAYS.find((day) => day.key === activeWeekDay) || WEEK_DAYS[0];
  const activeDaySchedule = formData.weeklyOpenHours?.[activeWeekDayConfig.key] || {
    isClosed: false,
    openTime: '',
    closeTime: ''
  };

  useEffect(() => {
    async function loadPlaceCategories() {
      setCategoriesLoading(true);
      setCategoryLoadError('');

      try {
        const categories = await fetchPlaceCategories();
        const activeCategories = categories.filter((category) => category.is_active !== false);

        activeCategories.sort((first, second) => {
          const firstOrder = Number(first.sort_order ?? first.sortOrder ?? 0);
          const secondOrder = Number(second.sort_order ?? second.sortOrder ?? 0);

          if (firstOrder !== secondOrder) {
            return firstOrder - secondOrder;
          }

          return String(first.name || '').localeCompare(String(second.name || ''));
        });

        setPlaceCategories(activeCategories);
      } catch (error) {
        setCategoryLoadError(error.response?.data?.message || 'Could not load categories. Please refresh this page.');
      } finally {
        setCategoriesLoading(false);
      }
    }

    loadPlaceCategories();
  }, []);

  useEffect(() => {
    async function loadMerchantServices() {
      setServicesLoading(true);
      setServiceLoadError('');

      try {
        const services = await fetchMerchantServices();
        const activeServices = services.filter((service) => service.is_active !== false);

        activeServices.sort((first, second) => {
          const firstOrder = Number(first.sort_order ?? first.sortOrder ?? 0);
          const secondOrder = Number(second.sort_order ?? second.sortOrder ?? 0);

          if (firstOrder !== secondOrder) {
            return firstOrder - secondOrder;
          }

          return String(first.name || '').localeCompare(String(second.name || ''));
        });

        setMerchantServices(activeServices);
      } catch (error) {
        setServiceLoadError(error.response?.data?.message || 'Could not load services. Please refresh this page.');
      } finally {
        setServicesLoading(false);
      }
    }

    loadMerchantServices();
  }, []);

  useEffect(() => {
    async function loadWards() {
      setWardsLoading(true);
      setWardLoadError('');

      try {
        const wardData = await fetchWards();
        const sortedWards = [...(Array.isArray(wardData) ? wardData : [])].sort((first, second) =>
          String(first.name || '').localeCompare(String(second.name || ''))
        );

        setWards(sortedWards);
      } catch (error) {
        setWardLoadError(error.response?.data?.message || 'Could not load wards. Please refresh this page.');
      } finally {
        setWardsLoading(false);
      }
    }

    loadWards();
  }, []);

  const unlockResubmitIfNeeded = () => {
    if (isResubmitLocked) {
      setIsResubmitLocked(false);
    }
  };

  const toDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    unlockResubmitIfNeeded();

    setFormData((prev) => {
      const isWardChanged = name === 'wardId' && String(prev.wardId || '') !== String(value || '');
      const nextFormData = {
        ...prev,
        [name]: value
      };

      if (isWardChanged) {
        // Force repick when ward changes so pinned point always matches selected ward.
        nextFormData.latitude = null;
        nextFormData.longitude = null;
      }

      const isGlobalHoursField = name === 'startTime' || name === 'endTime';

      if (isGlobalHoursField && nextFormData.startTime && nextFormData.endTime) {
        nextFormData.weeklyOpenHours = WEEK_DAYS.reduce((accumulator, day) => {
          const daySchedule = prev.weeklyOpenHours?.[day.key] || {
            isClosed: false,
            openTime: '',
            closeTime: ''
          };

          const shouldPreserveManualDay = Boolean(weeklyManualOverrides[day.key]);

          if (shouldPreserveManualDay || daySchedule.isClosed) {
            accumulator[day.key] = daySchedule;
            return accumulator;
          }

          accumulator[day.key] = {
            ...daySchedule,
            openTime: nextFormData.startTime,
            closeTime: nextFormData.endTime
          };

          return accumulator;
        }, {});
      }

      return nextFormData;
    });
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }

    if (name === 'wardId' && formErrors.location) {
      setFormErrors((prev) => ({
        ...prev,
        location: ''
      }));
    }

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const validateForm = () => {
    const errors = {};

    // Required fields
    if (!formData.venueName.trim()) errors.venueName = 'Venue name is required';
    if (!formData.category) errors.category = 'Category is required';
    if (formData.category && !placeCategories.some((category) => String(category.id) === String(formData.category))) {
      errors.category = 'Selected category is not available';
    }
    if (!categoriesLoading && !placeCategories.length) {
      errors.category = 'No active categories found. Contact admin to add categories.';
    }
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!wardsLoading && wards.length && !formData.wardId) errors.wardId = 'Ward is required';
    if (formData.wardId && !wards.some((ward) => String(ward.ward_id) === String(formData.wardId))) {
      errors.wardId = 'Selected ward is not available';
    }
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.businessLicense) errors.businessLicense = 'Business license is required';
    
    // Location picking is mandatory
    if (formData.latitude === null || formData.longitude === null) {
      errors.location = 'You must pick location on map to continue';
    }

    // Price range validation
    if (!formData.minPrice) errors.minPrice = 'Min price is required';
    if (!formData.maxPrice) errors.maxPrice = 'Max price is required';
    if (formData.minPrice || formData.maxPrice) {
      // Check if values are numeric
      const minVal = parseFloat(formData.minPrice);
      const maxVal = parseFloat(formData.maxPrice);
      
      if (isNaN(minVal)) errors.minPrice = 'Min price must be a valid number';
      if (isNaN(maxVal)) errors.maxPrice = 'Max price must be a valid number';
      
      if (!isNaN(minVal) && !isNaN(maxVal) && minVal >= maxVal) {
        errors.maxPrice = 'Max price must be higher than min price';
      }
    }

    // Operating hours validation
    if (formData.startTime && formData.endTime) {
      if (formData.startTime >= formData.endTime) {
        errors.endTime = 'End time must be after start time';
      }
    }

    // Weekly open hours validation
    WEEK_DAYS.forEach((day) => {
      const daySchedule = formData.weeklyOpenHours?.[day.key] || {};

      if (daySchedule.isClosed) {
        return;
      }

      const hasOpen = Boolean(daySchedule.openTime);
      const hasClose = Boolean(daySchedule.closeTime);

      if (!hasOpen && !hasClose) {
        return;
      }

      if (!hasOpen || !hasClose) {
        errors.weeklyOpenHours = 'Each opened day must include both open and close times';
        return;
      }

      if (daySchedule.openTime >= daySchedule.closeTime) {
        errors.weeklyOpenHours = 'Weekly OpenHours: close time must be after open time';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImagesChange = (images) => {
    unlockResubmitIfNeeded();

    setFormData((prev) => ({
      ...prev,
      images
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleServicesChange = (services) => {
    unlockResubmitIfNeeded();

    const availableServiceIds = new Set(
      merchantServices
        .map((service) => Number(service.id))
        .filter((serviceId) => Number.isInteger(serviceId) && serviceId > 0)
    );

    const normalizedServices = Array.isArray(services)
      ? [...new Set(services.map((serviceId) => Number(serviceId)).filter((serviceId) => availableServiceIds.has(serviceId)))]
      : [];

    setFormData((prev) => ({
      ...prev,
      selectedServices: normalizedServices
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleBusinessLicenseChange = (file) => {
    unlockResubmitIfNeeded();

    setFormData((prev) => ({
      ...prev,
      businessLicense: file
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleLocationSelect = (location) => {
    unlockResubmitIfNeeded();

    setFormData((prev) => ({
      ...prev,
      latitude: location.lat,
      longitude: location.lng
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const openLocationPicker = () => {
    unlockResubmitIfNeeded();

    if (!formData.wardId) {
      setFormErrors((prev) => ({
        ...prev,
        wardId: prev.wardId || 'Select ward before picking location on map'
      }));
      return;
    }

    setIsLocationPickerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isResubmitLocked) {
      setSubmitStatus({
        type: 'error',
        message: 'This venue has already been submitted. Update any field before submitting again.'
      });
      return;
    }

    if (!validateForm()) {
      setSubmitStatus({
        type: 'error',
        message: 'Please fix the errors before submitting'
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      let coverImageUrl = '';
      let galleryImageUrls = [];
      let businessLicenseImageUrl = '';

      if (formData.images.length > 0) {
        galleryImageUrls = await Promise.all(formData.images.map((imageFile) => toDataUrl(imageFile)));
        coverImageUrl = galleryImageUrls[0] || '';
      }

      if (formData.businessLicense) {
        businessLicenseImageUrl = await toDataUrl(formData.businessLicense);
      }

      const selectedCategory =
        placeCategories.find((category) => String(category.id) === String(formData.category)) || null;
      const selectedWard =
        wards.find((ward) => String(ward.ward_id) === String(formData.wardId)) || null;

      const response = await createVenueRequest({
        name: formData.venueName,
        address: formData.address,
        wardId: selectedWard?.ward_id || null,
        categoryId: selectedCategory?.id || null,
        category: selectedCategory?.name || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        description: formData.description,
        phone: formData.phone,
        coverImageUrl,
        businessLicenseImageUrl,
        metadata: {
          category: selectedCategory?.slug || '',
          categoryName: selectedCategory?.name || '',
          wardId: selectedWard?.ward_id || null,
          wardName: selectedWard?.name || null,
          minPrice: formData.minPrice ? Number(formData.minPrice) : null,
          maxPrice: formData.maxPrice ? Number(formData.maxPrice) : null,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          weeklyOpenHours: formData.weeklyOpenHours,
          selectedServices: formData.selectedServices,
          imagesCount: formData.images.length,
          galleryImages: galleryImageUrls
        }
      });

      setSubmitStatus({
        type: 'success',
        message: `Venue submitted successfully. Assigned ward: ${response.detectedWard || 'Pending detection'} and awaiting admin approval.`
      });
      setIsResubmitLocked(true);

      // Reset form
      setTimeout(() => {
        setFormData({
          venueName: '',
          category: '',
          address: '',
          wardId: '',
          latitude: null,
          longitude: null,
          phone: '',
          minPrice: '',
          maxPrice: '',
          startTime: '',
          endTime: '',
          weeklyOpenHours: buildDefaultWeeklyOpenHours(),
          description: '',
          selectedServices: [],
          images: [],
          businessLicense: null
        });
        setWeeklyManualOverrides(buildDefaultWeeklyOverrideMap());
        setFormErrors({});
        setSubmitStatus(null);
      }, 3500);
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error.response?.data?.message || 'Failed to submit venue. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="merchant-venue-form-container">
      <div className="form-header">
        <h1>Register Your Venue</h1>
        <p>Fill in all details to get your venue listed on Smart City Discovery</p>
      </div>

      <form className="merchant-venue-form" onSubmit={handleSubmit}>
        {/* Section 1: Images */}
        <div className="form-section">
          <div className="section-header">
            <h2>1. Photos</h2>
            <p className="section-hint">Upload up to 6 photos of your venue</p>
          </div>
          <ImageUploader maxImages={6} onImagesChange={handleImagesChange} />
        </div>

        {/* Section 2: Basic Info */}
        <div className="form-section">
          <div className="section-header">
            <h2>2. Basic Information</h2>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="venueName">
                Venue Name <span className="required">*</span>
                {formErrors.venueName && <span className="error-text"> - {formErrors.venueName}</span>}
              </label>
              <input
                type="text"
                id="venueName"
                name="venueName"
                value={formData.venueName}
                onChange={handleInputChange}
                placeholder="Enter venue name"
                required
                className={`form-input ${formErrors.venueName ? 'input-error' : ''}`}
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">
                Category <span className="required">*</span>
                {formErrors.category && <span className="error-text"> - {formErrors.category}</span>}
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                disabled={categoriesLoading}
                className={`form-input ${formErrors.category ? 'input-error' : ''}`}
              >
                <option value="">
                  {categoriesLoading ? 'Loading categories...' : 'Select a category'}
                </option>
                {placeCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoryLoadError ? <p className="error-text">{categoryLoadError}</p> : null}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone Number <span className="required">*</span>
              {formErrors.phone && <span className="error-text"> - {formErrors.phone}</span>}
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="e.g., +84 123 456 789"
              required
              className={`form-input ${formErrors.phone ? 'input-error' : ''}`}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell us about your venue, atmosphere, specialties..."
              rows="5"
              className="form-textarea"
            />
          </div>
        </div>

        {/* Section 3: Location & Hours */}
        <div className="form-section">
          <div className="section-header">
            <h2>3. Location & Hours</h2>
          </div>

          <div className="form-group">
            <label>
              Address <span className="required">*</span>
              {formErrors.address && <span className="error-text"> - {formErrors.address}</span>}
            </label>
            <div className="address-input-group">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter detailed address"
                required
                className={`form-input ${formErrors.address ? 'input-error' : ''}`}
              />

              <select
                id="wardId"
                name="wardId"
                value={formData.wardId}
                onChange={handleInputChange}
                disabled={wardsLoading}
                className={`form-input ward-select ${formErrors.wardId ? 'input-error' : ''}`}
              >
                <option value="">{wardsLoading ? 'Loading wards...' : 'Select ward'}</option>
                {wards.map((ward) => (
                  <option key={ward.ward_id} value={String(ward.ward_id)}>
                    {ward.name}
                  </option>
                ))}
              </select>

              <button type="button" className={`btn-map-picker ${formErrors.location ? 'btn-error' : ''}`} onClick={openLocationPicker}>
                📍 Pick on Map
              </button>
            </div>
            {formErrors.wardId && <span className="error-text">🔴 {formErrors.wardId}</span>}
            {wardLoadError ? <p className="error-text">{wardLoadError}</p> : null}
            {formErrors.location && <span className="error-text">🔴 {formErrors.location}</span>}
            {formData.latitude && formData.longitude && (
              <p className="location-display">
                ✓ Selected: ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
              </p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="endTime">
                End Time
                {formErrors.endTime && <span className="error-text"> - {formErrors.endTime}</span>}
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                className={`form-input ${formErrors.endTime ? 'input-error' : ''}`}
              />
            </div>
          </div>

          <div className="weekly-open-hours-card">
            <div className="weekly-open-hours-header">
              <h4>Weekly Opening Hours</h4>
              <p>Set opening and closing time for each day. Select Off to mark a closed day.</p>
              {formErrors.weeklyOpenHours ? <p className="error-text">{formErrors.weeklyOpenHours}</p> : null}
            </div>

            <div className="weekly-open-hours-tabs">
              {WEEK_DAYS.map((day) => {
                const daySchedule = formData.weeklyOpenHours?.[day.key] || {
                  isClosed: false,
                  openTime: '',
                  closeTime: ''
                };
                const isActive = day.key === activeWeekDay;

                return (
                  <button
                    key={day.key}
                    type="button"
                    className={`weekly-open-hours-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveWeekDay(day.key)}
                  >
                    <span className="tab-day-label">{day.label}</span>
                    <span className={`tab-day-status ${daySchedule.isClosed ? 'closed' : 'open'}`}>
                      {daySchedule.isClosed ? 'Off' : 'Open'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="weekly-open-hours-editor">
              <div className="weekly-open-hours-editor-header">
                <h5>{activeWeekDayConfig.label === 'Mon' ? 'Monday' : activeWeekDayConfig.label === 'Tue' ? 'Tuesday' : activeWeekDayConfig.label === 'Wed' ? 'Wednesday' : activeWeekDayConfig.label === 'Thu' ? 'Thursday' : activeWeekDayConfig.label === 'Fri' ? 'Friday' : activeWeekDayConfig.label === 'Sat' ? 'Saturday' : 'Sunday'}</h5>
                <button
                  type="button"
                  className={`day-open-toggle ${activeDaySchedule.isClosed ? 'closed' : 'open'}`}
                  onClick={() => handleWeeklyHoursChange(activeWeekDayConfig.key, 'isClosed', !activeDaySchedule.isClosed)}
                >
                  {activeDaySchedule.isClosed ? 'Off' : 'Open'}
                </button>
              </div>

              <div className="weekly-open-hours-editor-grid">
                <div className="form-group">
                  <label htmlFor={`open-${activeWeekDayConfig.key}`}>Start</label>
                  <input
                    id={`open-${activeWeekDayConfig.key}`}
                    type="time"
                    value={activeDaySchedule.openTime}
                    disabled={activeDaySchedule.isClosed}
                    onChange={(event) => handleWeeklyHoursChange(activeWeekDayConfig.key, 'openTime', event.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`close-${activeWeekDayConfig.key}`}>End</label>
                  <input
                    id={`close-${activeWeekDayConfig.key}`}
                    type="time"
                    value={activeDaySchedule.closeTime}
                    disabled={activeDaySchedule.isClosed}
                    onChange={(event) => handleWeeklyHoursChange(activeWeekDayConfig.key, 'closeTime', event.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="minPrice">
                Minimum Price (VNĐ) <span className="required">*</span>
                {formErrors.minPrice && <span className="error-text"> - {formErrors.minPrice}</span>}
              </label>
              <input
                type="number"
                id="minPrice"
                name="minPrice"
                value={formData.minPrice}
                onChange={handleInputChange}
                placeholder="e.g., 50000"
                min="0"
                step="1000"
                required
                className={`form-input ${formErrors.minPrice ? 'input-error' : ''}`}
              />
              {formData.minPrice && !formErrors.minPrice && (
                <p className="price-display">{parseInt(formData.minPrice).toLocaleString('vi-VN')} VNĐ</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="maxPrice">
                Maximum Price (VNĐ) <span className="required">*</span>
                {formErrors.maxPrice && <span className="error-text"> - {formErrors.maxPrice}</span>}
              </label>
              <input
                type="number"
                id="maxPrice"
                name="maxPrice"
                value={formData.maxPrice}
                onChange={handleInputChange}
                placeholder="e.g., 500000"
                min="0"
                step="1000"
                required
                className={`form-input ${formErrors.maxPrice ? 'input-error' : ''}`}
              />
              {formData.maxPrice && !formErrors.maxPrice && (
                <p className="price-display">{parseInt(formData.maxPrice).toLocaleString('vi-VN')} VNĐ</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Services */}
        <div className="form-section">
          <div className="section-header">
            <h2>4. Services Offered</h2>
            <p className="section-hint">
              {servicesLoading ? 'Loading services...' : 'Select all applicable services'}
            </p>
          </div>
          <ServiceSelector
            availableServices={merchantServices}
            selectedServices={formData.selectedServices}
            onServicesChange={handleServicesChange}
            disabled={servicesLoading}
          />
          {serviceLoadError ? <p className="error-text">{serviceLoadError}</p> : null}
        </div>

        {/* Section 5: Business License */}
        <div className="form-section">
          <div className="section-header">
            <h2>5. Verification</h2>
          </div>
          <BusinessLicenseUploader onLicenseChange={handleBusinessLicenseChange} />
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <div className="form-submit-block">
            <button
              type="submit"
              disabled={isSubmitting || isResubmitLocked}
              className="btn-submit"
            >
              {isSubmitting ? 'Submitting...' : isResubmitLocked ? 'Submitted' : 'Submit Venue for Review'}
            </button>
            <p className="form-note">Your venue will be reviewed by our admin team before going live.</p>
          </div>

          <div className={`submit-status-inline ${submitStatus?.type || 'idle'}`} aria-live="polite">
            {submitStatus ? (
              <>
                <strong>{submitStatus.type === 'success' ? 'Success' : 'Error'}</strong>
                <span>{submitStatus.message}</span>
              </>
            ) : (
              <span className="submit-status-placeholder">Submission status will appear here.</span>
            )}
          </div>
        </div>
      </form>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onLocationSelect={handleLocationSelect}
        selectedWardId={formData.wardId}
        defaultLocation={
          formData.latitude && formData.longitude
            ? { lat: formData.latitude, lng: formData.longitude }
            : null
        }
      />
    </div>
  );
}

export default MerchantVenueForm;

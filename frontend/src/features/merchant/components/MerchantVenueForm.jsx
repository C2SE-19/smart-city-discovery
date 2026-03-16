import { useEffect, useState } from 'react';
import ImageUploader from './ImageUploader';
import ServiceSelector from './ServiceSelector';
import BusinessLicenseUploader from './BusinessLicenseUploader';
import LocationPickerModal from '../../../shared/components/modals/LocationPickerModal';
import { createVenueRequest } from '../../../services/api/venuesApi';
import { fetchPlaceCategories } from '../../../services/api/placeCategoriesApi';
import '../styles/MerchantVenueForm.css';

function MerchantVenueForm() {
  const [formData, setFormData] = useState({
    venueName: '',
    category: '',
    address: '',
    latitude: null,
    longitude: null,
    phone: '',
    minPrice: '',
    maxPrice: '',
    startTime: '',
    endTime: '',
    title: '',
    description: '',
    selectedServices: [],
    images: [],
    businessLicense: null
  });

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [placeCategories, setPlaceCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState('');

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

  const toDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
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
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.title.trim()) errors.title = 'Venue title is required';
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

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImagesChange = (images) => {
    setFormData((prev) => ({
      ...prev,
      images
    }));
  };

  const handleServicesChange = (services) => {
    setFormData((prev) => ({
      ...prev,
      selectedServices: services
    }));
  };

  const handleBusinessLicenseChange = (file) => {
    setFormData((prev) => ({
      ...prev,
      businessLicense: file
    }));
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      latitude: location.lat,
      longitude: location.lng
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      let businessLicenseImageUrl = '';

      if (formData.images.length > 0) {
        coverImageUrl = await toDataUrl(formData.images[0]);
      }

      if (formData.businessLicense) {
        businessLicenseImageUrl = await toDataUrl(formData.businessLicense);
      }

      const selectedCategory =
        placeCategories.find((category) => String(category.id) === String(formData.category)) || null;

      const response = await createVenueRequest({
        name: formData.venueName,
        title: formData.title,
        address: formData.address,
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
          minPrice: formData.minPrice ? Number(formData.minPrice) : null,
          maxPrice: formData.maxPrice ? Number(formData.maxPrice) : null,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          selectedServices: formData.selectedServices,
          imagesCount: formData.images.length
        }
      });

      setSubmitStatus({
        type: 'success',
        message: `Venue submitted successfully. Assigned ward: ${response.detectedWard || 'Pending detection'} and awaiting admin approval.`
      });

      // Reset form
      setTimeout(() => {
        setFormData({
          venueName: '',
          category: '',
          address: '',
          latitude: null,
          longitude: null,
          phone: '',
          minPrice: '',
          maxPrice: '',
          startTime: '',
          endTime: '',
          title: '',
          description: '',
          selectedServices: [],
          images: [],
          businessLicense: null
        });
        setFormErrors({});
        setSubmitStatus(null);
      }, 2000);
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
        {/* Status Messages */}
        {submitStatus && (
          <div className={`status-message ${submitStatus.type}`}>
            {submitStatus.type === 'success' ? '✓ ' : '✕ '}
            {submitStatus.message}
          </div>
        )}

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
          </div>

          <div className="form-group">
            <label htmlFor="title">
              Venue Title <span className="required">*</span>
              {formErrors.title && <span className="error-text"> - {formErrors.title}</span>}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Short title for your venue"
              required
              className={`form-input ${formErrors.title ? 'input-error' : ''}`}
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
              <button type="button" className={`btn-map-picker ${formErrors.location ? 'btn-error' : ''}`} onClick={() => setIsLocationPickerOpen(true)}>
                📍 Pick on Map
              </button>
            </div>
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
            <p className="section-hint">Select all applicable services</p>
          </div>
          <ServiceSelector onServicesChange={handleServicesChange} />
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-submit"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Venue for Review'}
          </button>
          <p className="form-note">Your venue will be reviewed by our admin team before going live.</p>
        </div>
      </form>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onLocationSelect={handleLocationSelect}
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

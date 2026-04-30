import { useEffect, useMemo, useState } from 'react';
import ImageUploader from './ImageUploader';
import ServiceSelector from './ServiceSelector';
import BusinessLicenseUploader from './BusinessLicenseUploader';
import LocationPickerModal from '../../../shared/components/modals/LocationPickerModal';
import { createVenueRequest, fetchVenueEditDraft, submitVenueUpdateRequest } from '../../../services/api/venuesApi';
import { fetchPlaceCategories } from '../../../services/api/placeCategoriesApi';
import { fetchMerchantServices } from '../../../services/api/merchantServicesApi';
import { fetchWards } from '../../../services/api/wardsApi';
import { buildPlaceCategoryTree, resolveCategoryBranch } from '../../../utils/placeCategoryTree';
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

function resolveApiOrigin() {
  const configuredBaseUrl =
    import.meta.env.VITE_API_BASE_URL
    || (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '/api');

  if (typeof window !== 'undefined') {
    try {
      return new URL(configuredBaseUrl, window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  }

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

function resolveAssetUrl(rawUrl) {
  const normalizedUrl = String(rawUrl || '').trim();

  if (!normalizedUrl || normalizedUrl.toLowerCase() === 'nan' || normalizedUrl.toLowerCase() === 'null') {
    return '';
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  const apiOrigin = resolveApiOrigin();
  if (normalizedUrl.startsWith('/')) {
    return `${apiOrigin}${normalizedUrl}`;
  }

  return `${apiOrigin}/${normalizedUrl}`;
}

function normalizeVenueMetadata(metadata) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeServiceSelections(selectedServices) {
  if (!Array.isArray(selectedServices)) {
    return [];
  }

  return [...new Set(selectedServices
    .map((serviceId) => Number(serviceId))
    .filter((serviceId) => Number.isInteger(serviceId) && serviceId > 0))];
}

function normalizeWeeklyDaySchedule(rawDaySchedule, fallbackStart, fallbackEnd) {
  const source = rawDaySchedule && typeof rawDaySchedule === 'object' ? rawDaySchedule : {};
  const isClosed = Boolean(source.isClosed ?? source.closed ?? source.is_off);
  const openTimeCandidate = String(source.openTime ?? source.open ?? source.start ?? '').trim();
  const closeTimeCandidate = String(source.closeTime ?? source.close ?? source.end ?? '').trim();
  const hasOpenTime = /^\d{2}:\d{2}$/.test(openTimeCandidate);
  const hasCloseTime = /^\d{2}:\d{2}$/.test(closeTimeCandidate);

  if (isClosed) {
    return {
      isClosed: true,
      openTime: '',
      closeTime: ''
    };
  }

  return {
    isClosed: false,
    openTime: hasOpenTime ? openTimeCandidate : fallbackStart,
    closeTime: hasCloseTime ? closeTimeCandidate : fallbackEnd
  };
}

function normalizeWeeklyOpenHours(metadata) {
  const sourceMetadata = normalizeVenueMetadata(metadata);
  const fallbackStart = /^\d{2}:\d{2}$/.test(String(sourceMetadata.startTime || '').trim())
    ? String(sourceMetadata.startTime || '').trim()
    : '';
  const fallbackEnd = /^\d{2}:\d{2}$/.test(String(sourceMetadata.endTime || '').trim())
    ? String(sourceMetadata.endTime || '').trim()
    : '';
  const sourceWeekly = sourceMetadata.weeklyOpenHours && typeof sourceMetadata.weeklyOpenHours === 'object'
    ? sourceMetadata.weeklyOpenHours
    : sourceMetadata.weeklySchedule && typeof sourceMetadata.weeklySchedule === 'object'
      ? sourceMetadata.weeklySchedule
      : {};

  return WEEK_DAYS.reduce((accumulator, day) => {
    accumulator[day.key] = normalizeWeeklyDaySchedule(sourceWeekly?.[day.key], fallbackStart, fallbackEnd);
    return accumulator;
  }, {});
}

function resolveExistingGalleryImageUrls(venue, metadata) {
  const metadataObject = normalizeVenueMetadata(metadata);
  const candidates = [];

  if (Array.isArray(venue?.venue_images)) {
    candidates.push(...venue.venue_images);
  }

  if (Array.isArray(metadataObject.galleryImages)) {
    candidates.push(...metadataObject.galleryImages);
  }

  if (Array.isArray(metadataObject.images)) {
    candidates.push(...metadataObject.images);
  }

  if (venue?.cover_image_url) {
    candidates.unshift(venue.cover_image_url);
  }

  return [...new Set(candidates
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}

function derivePrimaryTimeRangeFromWeeklyHours(weeklyOpenHours) {
  for (const day of WEEK_DAYS) {
    const daySchedule = weeklyOpenHours?.[day.key] || {};
    const isClosed = Boolean(daySchedule.isClosed);

    if (isClosed) {
      continue;
    }

    const openTime = String(daySchedule.openTime || '').trim();
    const closeTime = String(daySchedule.closeTime || '').trim();

    if (/^\d{2}:\d{2}$/.test(openTime) && /^\d{2}:\d{2}$/.test(closeTime) && openTime < closeTime) {
      return {
        startTime: openTime,
        endTime: closeTime
      };
    }
  }

  return {
    startTime: '',
    endTime: ''
  };
}

function normalizeWeeklyOpenHoursForPayload(weeklyOpenHours, fallbackStart, fallbackEnd) {
  const hasFallbackRange =
    /^\d{2}:\d{2}$/.test(String(fallbackStart || '').trim()) &&
    /^\d{2}:\d{2}$/.test(String(fallbackEnd || '').trim()) &&
    String(fallbackStart) < String(fallbackEnd);

  return WEEK_DAYS.reduce((accumulator, day) => {
    const daySchedule = weeklyOpenHours?.[day.key] || {};
    const isClosed = Boolean(daySchedule.isClosed);
    const openTime = String(daySchedule.openTime || '').trim();
    const closeTime = String(daySchedule.closeTime || '').trim();
    const isValidRange = /^\d{2}:\d{2}$/.test(openTime) && /^\d{2}:\d{2}$/.test(closeTime) && openTime < closeTime;

    if (isClosed) {
      accumulator[day.key] = {
        isClosed: true,
        openTime: '',
        closeTime: ''
      };
      return accumulator;
    }

    if (isValidRange) {
      accumulator[day.key] = {
        isClosed: false,
        openTime,
        closeTime
      };
      return accumulator;
    }

    if (hasFallbackRange) {
      accumulator[day.key] = {
        isClosed: false,
        openTime: String(fallbackStart),
        closeTime: String(fallbackEnd)
      };
      return accumulator;
    }

    accumulator[day.key] = {
      isClosed: true,
      openTime: '',
      closeTime: ''
    };

    return accumulator;
  }, {});
}

function MerchantVenueForm({ editVenueId = null }) {
  const isEditMode = false;
  const [activeWeekDay, setActiveWeekDay] = useState(WEEK_DAYS[0].key);
  const [formData, setFormData] = useState({
    venueName: '',
    mainCategory: '',
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
    businessLicense: null,
    existingCoverImageUrl: '',
    existingGalleryImageUrls: [],
    existingBusinessLicenseUrl: ''
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
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState('');
  const [pendingUpdateRequest, setPendingUpdateRequest] = useState(null);
  const placeCategoryTree = useMemo(() => buildPlaceCategoryTree(placeCategories), [placeCategories]);
  const mainCategories = placeCategoryTree.rootCategories;
  const selectedMainCategoryChildren = useMemo(
    () => placeCategoryTree.childrenByParentId.get(Number(formData.mainCategory)) || [],
    [formData.mainCategory, placeCategoryTree]
  );
  const existingImageCount = Math.min(Array.isArray(formData.existingGalleryImageUrls) ? formData.existingGalleryImageUrls.length : 0, 6);
  const remainingUploadSlots = Math.max(0, 6 - existingImageCount);

  const handleWeeklyHoursChange = (dayKey, field, value) => {
    unlockResubmitIfNeeded();
    setWeeklyManualOverrides((prev) => {
      const next = {
        ...prev,
        [dayKey]: true
      };

      if (dayKey === 'monday') {
        WEEK_DAYS.forEach((day) => {
          if (day.key !== 'monday') {
            next[day.key] = false;
          }
        });
      }

      return next;
    });

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

      const nextWeeklyOpenHours = {
        ...prev.weeklyOpenHours,
        [dayKey]: nextDay
      };

      if (dayKey === 'monday') {
        WEEK_DAYS.forEach((day) => {
          if (day.key === 'monday') {
            return;
          }

          nextWeeklyOpenHours[day.key] = {
            ...(nextWeeklyOpenHours[day.key] || {}),
            isClosed: nextDay.isClosed,
            openTime: nextDay.isClosed ? '' : nextDay.openTime,
            closeTime: nextDay.isClosed ? '' : nextDay.closeTime
          };
        });
      }

      return {
        ...prev,
        weeklyOpenHours: nextWeeklyOpenHours
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
  const selectedWardName =
    wards.find((ward) => String(ward.ward_id) === String(formData.wardId || ''))?.name || '';
  const initialAddressQuery = [
    String(formData.address || '').trim(),
    String(selectedWardName || '').trim(),
    'Đà Nẵng',
    'Việt Nam'
  ]
    .filter(Boolean)
    .join(', ');

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

  useEffect(() => {
    if (!isEditMode) {
      setLoadingDraft(false);
      setDraftLoadError('');
      setPendingUpdateRequest(null);
      return;
    }

    let isMounted = true;

    async function loadEditDraft() {
      setLoadingDraft(true);
      setDraftLoadError('');

      try {
        const response = await fetchVenueEditDraft(editVenueId);
        const venue = response?.venue || null;
        const pendingRequest = response?.pendingUpdateRequest || null;

        if (!venue) {
          throw new Error('Could not load venue details for editing');
        }

        const pendingSnapshot = pendingRequest?.proposed_snapshot && typeof pendingRequest.proposed_snapshot === 'object'
          ? pendingRequest.proposed_snapshot
          : null;

        const venueMetadata = normalizeVenueMetadata(venue.metadata);
        const snapshotMetadata = normalizeVenueMetadata(pendingSnapshot?.metadata);
        const mergedMetadata = {
          ...venueMetadata,
          ...snapshotMetadata
        };
        const snapshotLatitude = Number(pendingSnapshot?.latitude);
        const snapshotLongitude = Number(pendingSnapshot?.longitude);
        const venueLatitude = Number(venue.latitude);
        const venueLongitude = Number(venue.longitude);
        const resolvedLatitude = Number.isFinite(snapshotLatitude)
          ? snapshotLatitude
          : Number.isFinite(venueLatitude)
            ? venueLatitude
            : null;
        const resolvedLongitude = Number.isFinite(snapshotLongitude)
          ? snapshotLongitude
          : Number.isFinite(venueLongitude)
            ? venueLongitude
            : null;
        const resolvedCoverImageUrl = String(
          pendingSnapshot?.coverImageUrl || venue.cover_image_url || ''
        ).trim();
        const resolvedBusinessLicenseImageUrl = String(
          pendingSnapshot?.businessLicenseImageUrl || venue.business_license_image_url || ''
        ).trim();
        const resolvedGalleryImageUrls = resolveExistingGalleryImageUrls(
          {
            ...venue,
            cover_image_url: resolvedCoverImageUrl
          },
          {
            ...mergedMetadata,
            galleryImages: Array.isArray(snapshotMetadata.galleryImages)
              ? snapshotMetadata.galleryImages
              : mergedMetadata.galleryImages
          }
        );
        const resolvedWeeklyOpenHours = normalizeWeeklyOpenHours(mergedMetadata);
        const resolvedWeeklyOverrides = WEEK_DAYS.reduce((accumulator, day) => {
          const daySchedule = resolvedWeeklyOpenHours[day.key];
          accumulator[day.key] = Boolean(daySchedule?.isClosed || daySchedule?.openTime || daySchedule?.closeTime);
          return accumulator;
        }, {});
        const resolvedCategoryId = String(
          pendingSnapshot?.categoryId ?? venue.category_id ?? mergedMetadata.categoryId ?? ''
        ).trim();
        const resolvedCategoryBranch = resolveCategoryBranch(resolvedCategoryId, buildPlaceCategoryTree(placeCategories));

        const nextFormData = {
          venueName: String(pendingSnapshot?.name || pendingSnapshot?.title || venue.name || venue.title || '').trim(),
          mainCategory: String(
            resolvedCategoryBranch.mainCategory?.id || resolvedCategoryId || ''
          ).trim(),
          category: resolvedCategoryBranch.subcategory
            ? String(resolvedCategoryBranch.subcategory.id)
            : resolvedCategoryId,
          address: String(pendingSnapshot?.address || venue.address || '').trim(),
          wardId: String(pendingSnapshot?.wardId || venue.ward_id || mergedMetadata.wardId || '').trim(),
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          phone: String(pendingSnapshot?.phone || venue.phone || '').trim(),
          minPrice: mergedMetadata.minPrice !== undefined && mergedMetadata.minPrice !== null ? String(mergedMetadata.minPrice) : '',
          maxPrice: mergedMetadata.maxPrice !== undefined && mergedMetadata.maxPrice !== null ? String(mergedMetadata.maxPrice) : '',
          startTime: String(mergedMetadata.startTime || '').trim(),
          endTime: String(mergedMetadata.endTime || '').trim(),
          weeklyOpenHours: resolvedWeeklyOpenHours,
          description: String(pendingSnapshot?.description || venue.description || '').trim(),
          selectedServices: normalizeServiceSelections(mergedMetadata.selectedServices),
          images: [],
          businessLicense: null,
          existingCoverImageUrl: resolvedCoverImageUrl,
          existingGalleryImageUrls: resolvedGalleryImageUrls,
          existingBusinessLicenseUrl: resolvedBusinessLicenseImageUrl
        };

        if (!isMounted) {
          return;
        }

        setFormData(nextFormData);
        setWeeklyManualOverrides(resolvedWeeklyOverrides);
        setFormErrors({});
        setSubmitStatus(
          pendingRequest?.status === 'pending'
            ? {
                type: 'success',
                message: 'An existing pending location update was loaded. Submitting again will replace that pending request.'
              }
            : null
        );
        setPendingUpdateRequest(pendingRequest);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDraftLoadError(error.response?.data?.message || error.message || 'Could not load this venue for editing.');
      } finally {
        if (isMounted) {
          setLoadingDraft(false);
        }
      }
    }

    loadEditDraft();

    return () => {
      isMounted = false;
    };
  }, [editVenueId, isEditMode]);

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

  const handleMainCategoryChange = (event) => {
    const nextMainCategoryId = String(event.target.value || '').trim();
    const childCategories = placeCategoryTree.childrenByParentId.get(Number(nextMainCategoryId)) || [];

    unlockResubmitIfNeeded();
    setFormData((prev) => ({
      ...prev,
      mainCategory: nextMainCategoryId,
      category: childCategories.length ? '' : nextMainCategoryId
    }));

    setFormErrors((prev) => ({
      ...prev,
      category: '',
      subcategory: ''
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleSubcategoryChange = (event) => {
    const nextCategoryId = String(event.target.value || '').trim();

    unlockResubmitIfNeeded();
    setFormData((prev) => ({
      ...prev,
      category: nextCategoryId
    }));

    setFormErrors((prev) => ({
      ...prev,
      category: '',
      subcategory: ''
    }));

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  useEffect(() => {
    if (!placeCategories.length || !formData.category) {
      return;
    }

    const categoryBranch = resolveCategoryBranch(formData.category, placeCategoryTree);
    const nextMainCategoryId = String(categoryBranch.mainCategory?.id || formData.mainCategory || '').trim();

    if (nextMainCategoryId && nextMainCategoryId !== String(formData.mainCategory || '').trim()) {
      setFormData((prev) => ({
        ...prev,
        mainCategory: nextMainCategoryId
      }));
    }
  }, [formData.category, formData.mainCategory, placeCategories, placeCategoryTree]);

  const validateForm = () => {
    const errors = {};
    const requiresSubcategory = selectedMainCategoryChildren.length > 0;

    // Required fields
    if (!formData.venueName.trim()) errors.venueName = 'Venue name is required';
    if (!formData.mainCategory) errors.category = 'Main category is required';
    if (requiresSubcategory && !formData.category) errors.subcategory = 'Subcategory is required';
    if (!requiresSubcategory && !formData.category) errors.category = 'Category is required';
    if (formData.category && !placeCategories.some((category) => String(category.id) === String(formData.category))) {
      errors.subcategory = requiresSubcategory ? 'Selected subcategory is not available' : 'Selected category is not available';
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
    const hasBusinessLicense = Boolean(formData.businessLicense || formData.existingBusinessLicenseUrl);
    if (!hasBusinessLicense) errors.businessLicense = 'Business license is required';
    
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

  const handleSetExistingCoverImage = (targetImageUrl) => {
    const normalizedTarget = String(targetImageUrl || '').trim();
    if (!normalizedTarget) {
      return;
    }

    unlockResubmitIfNeeded();
    setFormData((prev) => {
      const currentGallery = Array.isArray(prev.existingGalleryImageUrls)
        ? prev.existingGalleryImageUrls
        : [];
      const targetIndex = currentGallery.findIndex(
        (imageUrl) => String(imageUrl || '').trim() === normalizedTarget
      );

      const nextGallery = targetIndex > 0
        ? [currentGallery[targetIndex], ...currentGallery.filter((_, index) => index !== targetIndex)]
        : currentGallery;

      return {
        ...prev,
        existingGalleryImageUrls: nextGallery,
        existingCoverImageUrl: normalizedTarget
      };
    });

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleRemoveExistingGalleryImage = (targetImageUrl) => {
    const normalizedTarget = String(targetImageUrl || '').trim();
    if (!normalizedTarget) {
      return;
    }

    unlockResubmitIfNeeded();

    setFormData((prev) => {
      const currentGallery = Array.isArray(prev.existingGalleryImageUrls)
        ? prev.existingGalleryImageUrls
        : [];
      const targetIndex = currentGallery.findIndex(
        (imageUrl) => String(imageUrl || '').trim() === normalizedTarget
      );

      if (targetIndex < 0) {
        return prev;
      }

      const nextGallery = currentGallery.filter((_, index) => index !== targetIndex);
      const currentCover = String(prev.existingCoverImageUrl || '').trim();
      const nextCover =
        currentCover && currentCover !== normalizedTarget
          ? currentCover
          : String(nextGallery[0] || '').trim();

      return {
        ...prev,
        existingGalleryImageUrls: nextGallery,
        existingCoverImageUrl: nextCover
      };
    });

    if (submitStatus?.type === 'success') {
      setSubmitStatus(null);
    }
  };

  const handleRemoveExistingBusinessLicense = () => {
    unlockResubmitIfNeeded();
    setFormData((prev) => ({
      ...prev,
      existingBusinessLicenseUrl: ''
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

    if (!isEditMode && isResubmitLocked) {
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
      let galleryImageUrls = Array.isArray(formData.existingGalleryImageUrls)
        ? formData.existingGalleryImageUrls
        : [];
      let coverImageUrl = String(formData.existingCoverImageUrl || galleryImageUrls[0] || '').trim();
      let businessLicenseImageUrl = String(formData.existingBusinessLicenseUrl || '').trim();

      const normalizedExistingGallery = [...new Set(
        galleryImageUrls
          .map((imageUrl) => String(imageUrl || '').trim())
          .filter(Boolean)
      )];
      galleryImageUrls = normalizedExistingGallery.slice(0, 6);

      if (formData.images.length > 0) {
        const uploadedGalleryImages = await Promise.all(formData.images.map((imageFile) => toDataUrl(imageFile)));
        const normalizedUploadedGallery = [...new Set(
          uploadedGalleryImages
            .map((imageUrl) => String(imageUrl || '').trim())
            .filter(Boolean)
        )];

        const combinedGallery = [...new Set([...galleryImageUrls, ...normalizedUploadedGallery])];
        galleryImageUrls = combinedGallery.length > 6 ? combinedGallery.slice(combinedGallery.length - 6) : combinedGallery;

        const normalizedPreferredCover = String(coverImageUrl || '').trim();
        if (normalizedPreferredCover && galleryImageUrls.includes(normalizedPreferredCover)) {
          coverImageUrl = normalizedPreferredCover;
        } else if (normalizedUploadedGallery.length) {
          coverImageUrl = galleryImageUrls.includes(normalizedUploadedGallery[0])
            ? normalizedUploadedGallery[0]
            : (galleryImageUrls[0] || '');
        } else {
          coverImageUrl = galleryImageUrls[0] || '';
        }
      }

      if (formData.businessLicense) {
        businessLicenseImageUrl = await toDataUrl(formData.businessLicense);
      }

      const selectedCategory =
        placeCategories.find((category) => String(category.id) === String(formData.category)) || null;
      const selectedWard =
        wards.find((ward) => String(ward.ward_id) === String(formData.wardId)) || null;
      const derivedTimeRange = derivePrimaryTimeRangeFromWeeklyHours(formData.weeklyOpenHours);
      const metadataStartTime = derivedTimeRange.startTime || String(formData.startTime || '').trim();
      const metadataEndTime = derivedTimeRange.endTime || String(formData.endTime || '').trim();
      const normalizedWeeklyOpenHoursPayload = normalizeWeeklyOpenHoursForPayload(
        formData.weeklyOpenHours,
        metadataStartTime,
        metadataEndTime
      );

      const payload = {
        name: formData.venueName,
        title: formData.venueName,
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
          startTime: metadataStartTime || null,
          endTime: metadataEndTime || null,
          weeklyOpenHours: normalizedWeeklyOpenHoursPayload,
          selectedServices: formData.selectedServices,
          imagesCount: galleryImageUrls.length,
          galleryImages: galleryImageUrls
        }
      };

      if (isEditMode) {
        const response = await submitVenueUpdateRequest(editVenueId, payload);

        setSubmitStatus({
          type: 'success',
          message: response.message || 'Venue update request submitted successfully. Awaiting admin review.'
        });
        setPendingUpdateRequest(response.updateRequest || pendingUpdateRequest || null);
        setFormData((prev) => ({
          ...prev,
          images: [],
          businessLicense: null,
          existingGalleryImageUrls: galleryImageUrls,
          existingCoverImageUrl: coverImageUrl,
          existingBusinessLicenseUrl: businessLicenseImageUrl
        }));
        return;
      }

      const response = await createVenueRequest(payload);

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
          businessLicense: null,
          existingCoverImageUrl: '',
          existingGalleryImageUrls: [],
          existingBusinessLicenseUrl: ''
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
      <div className="form-header" data-onboarding="merchant-form-header">
        <h1>{isEditMode ? 'Edit Venue Submission' : 'Register Your Venue'}</h1>
        <p>
          {isEditMode
            ? 'Update your venue information. Changes will be sent to admin for moderation before going live.'
            : 'Fill in all details to get your venue listed on Smart City Discovery'}
        </p>
      </div>

      {loadingDraft ? <p className="form-note">Loading venue draft...</p> : null}
      {draftLoadError ? <p className="error-text">{draftLoadError}</p> : null}
      {isEditMode && pendingUpdateRequest?.status === 'pending' ? (
        <p className="form-note">A location update for this venue is currently pending. Submitting now will replace that pending request.</p>
      ) : null}

      <form className="merchant-venue-form" onSubmit={handleSubmit}>
        {/* Section 1: Images */}
        <div className="form-section">
          <div className="section-header">
            <h2>1. Photos</h2>
            <p className="section-hint">Upload up to 6 photos of your venue</p>
          </div>

          {isEditMode && formData.existingGalleryImageUrls.length ? (
            <div className="merchant-existing-media-grid">
              {formData.existingGalleryImageUrls.slice(0, 6).map((imageUrl) => {
                const normalizedImageUrl = String(imageUrl || '').trim();
                const isCover = normalizedImageUrl === String(formData.existingCoverImageUrl || '').trim();

                return (
                  <div key={normalizedImageUrl} className="merchant-existing-media-card">
                    <img
                      src={resolveAssetUrl(normalizedImageUrl)}
                      alt="Existing venue"
                      className="merchant-existing-media-item"
                    />

                    <div className="merchant-existing-media-actions">
                      {isCover ? (
                        <span className="merchant-existing-cover-badge">Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="merchant-existing-action-btn"
                          onClick={() => handleSetExistingCoverImage(normalizedImageUrl)}
                        >
                          Set Cover
                        </button>
                      )}

                      <button
                        type="button"
                        className="merchant-existing-action-btn danger"
                        onClick={() => handleRemoveExistingGalleryImage(normalizedImageUrl)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="form-note">Existing images are shown above. New uploads will be added with existing photos (maximum 6 total).</p>
            </div>
          ) : null}

          {remainingUploadSlots > 0 ? (
            <ImageUploader maxImages={remainingUploadSlots} onImagesChange={handleImagesChange} />
          ) : (
            <p className="form-note">You already have 6 images. Remove at least one existing image above to upload a new one.</p>
          )}
        </div>

        {/* Section 2: Basic Info */}
        <div className="form-section" data-onboarding="merchant-form-basic">
          <div className="section-header">
            <span className="merchant-onboarding-anchor" data-onboarding-anchor="merchant-form-basic" aria-hidden="true" />
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mainCategory">
                Category <span className="required">*</span>
                {formErrors.category && <span className="error-text"> - {formErrors.category}</span>}
              </label>
              <select
                id="mainCategory"
                name="mainCategory"
                value={formData.mainCategory}
                onChange={handleMainCategoryChange}
                required
                disabled={categoriesLoading}
                className={`form-input ${formErrors.category ? 'input-error' : ''}`}
              >
                <option value="">
                  {categoriesLoading ? 'Loading categories...' : 'Select a main category'}
                </option>
                {mainCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoryLoadError ? <p className="error-text">{categoryLoadError}</p> : null}
            </div>

            <div className="form-group">
              <label htmlFor="subcategory">
                Subcategory
                {selectedMainCategoryChildren.length ? <span className="required">*</span> : null}
                {formErrors.subcategory && <span className="error-text"> - {formErrors.subcategory}</span>}
              </label>
              <select
                id="subcategory"
                name="subcategory"
                value={selectedMainCategoryChildren.length ? formData.category : ''}
                onChange={handleSubcategoryChange}
                disabled={categoriesLoading || !selectedMainCategoryChildren.length}
                className={`form-input ${formErrors.subcategory ? 'input-error' : ''}`}
              >
                <option value="">
                  {selectedMainCategoryChildren.length ? 'Select a subcategory' : 'No subcategory required'}
                </option>
                {selectedMainCategoryChildren.map((subcategory) => (
                  <option key={subcategory.id} value={String(subcategory.id)}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
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
        <div className="form-section" data-onboarding="merchant-form-location">
          <div className="section-header">
            <span className="merchant-onboarding-anchor" data-onboarding-anchor="merchant-form-location" aria-hidden="true" />
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
        <div className="form-section" data-onboarding="merchant-form-services">
          <div className="section-header">
            <span className="merchant-onboarding-anchor" data-onboarding-anchor="merchant-form-services" aria-hidden="true" />
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

          {isEditMode && formData.existingBusinessLicenseUrl ? (
            <div className="merchant-existing-license">
              <img
                src={resolveAssetUrl(formData.existingBusinessLicenseUrl)}
                alt="Existing business license"
                className="merchant-existing-license-image"
              />
              <button
                type="button"
                className="merchant-existing-action-btn danger"
                onClick={handleRemoveExistingBusinessLicense}
              >
                Remove Current License
              </button>
              <p className="form-note">Current business license on file. Upload a new file only if you need to replace it.</p>
            </div>
          ) : null}

          <BusinessLicenseUploader onLicenseChange={handleBusinessLicenseChange} />
        </div>

        {/* Submit Button */}
        <div className="form-actions" data-onboarding="merchant-form-submit">
          <div className="form-submit-block">
            <button
              type="submit"
              disabled={isSubmitting || loadingDraft || (!isEditMode && isResubmitLocked)}
              className="btn-submit"
            >
              {isSubmitting
                ? isEditMode
                  ? 'Submitting update...'
                  : 'Submitting...'
                : !isEditMode && isResubmitLocked
                  ? 'Submitted'
                  : isEditMode
                    ? 'Submit Location Update for Review'
                    : 'Submit Venue for Review'}
            </button>
            <p className="form-note">
              {isEditMode
                ? 'Your edited location and details will be reviewed by admin before applying to the live venue.'
                : 'Your venue will be reviewed by our admin team before going live.'}
            </p>
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
        initialAddressQuery={initialAddressQuery}
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

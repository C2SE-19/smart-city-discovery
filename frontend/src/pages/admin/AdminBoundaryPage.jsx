import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SectionCard from '../../components/common/SectionCard';
import {
  createAdminMerchantService,
  createAdminPlaceCategory,
  deleteAdminMerchantService,
  deleteAdminPlaceCategory,
  deleteAdminWard,
  fetchAdminMerchantServices,
  fetchAdminPlaceCategories,
  fetchAdminVenues,
  fetchAdminWards,
  moderateAdminVenue,
  updateAdminMerchantService,
  updateAdminPlaceCategory,
  upsertAdminWard,
} from '../../services/api/adminMapApi';
import './AdminBoundaryPage.css';

const DEFAULT_CENTER = [16.0471, 108.2068];
const DEFAULT_ZOOM = 12;
const EMPTY_BOUNDARY_TEMPLATE = '{\n  "type": "FeatureCollection",\n  "features": []\n}';

const PAGE_MODES = [
  {
    value: 'pending',
    label: 'Pending Posts',
    helper: 'Review merchant submissions and approve/reject each post.',
  },
  {
    value: 'ward',
    label: 'Ward Naming',
    helper: 'Click a ward boundary to update or delete it. Use Add Ward to create a new boundary.',
  },
  {
    value: 'category',
    label: 'Place Categories',
    helper: 'Manage a single shared category list used by merchant and user screens.',
  },
  {
    value: 'service',
    label: 'Services Offered - Merchant',
    helper: 'Manage service options shown in merchant registration and moderation details.',
  },
];

const CATEGORY_PIN_COLORS = ['#0f766e', '#ea580c', '#2563eb', '#db2777', '#7c3aed', '#65a30d', '#dc2626', '#0891b2'];
const categoryIconCache = new Map();

const approvedIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-approved',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pendingIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-pending',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const rejectedIcon = L.divIcon({
  className: 'admin-venue-pin admin-venue-pin-rejected',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function slugifyText(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeComparableText(value) {
  return String(value || '').trim();
}

function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalizeJsonValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function areJsonValuesEqual(firstValue, secondValue) {
  return JSON.stringify(canonicalizeJsonValue(firstValue)) === JSON.stringify(canonicalizeJsonValue(secondValue));
}

function extractBoundaryFeatures(boundary) {
  if (!boundary || typeof boundary !== 'object') {
    return [];
  }

  if (boundary.type === 'FeatureCollection' && Array.isArray(boundary.features)) {
    return boundary.features;
  }

  if (boundary.type === 'Feature') {
    return [boundary];
  }

  return [];
}

function toPolygonBoundaryFeatureCollection(boundary) {
  const polygonFeatures = extractBoundaryFeatures(boundary).filter((feature) => {
    const geometryType = feature?.geometry?.type;
    return geometryType === 'Polygon' || geometryType === 'MultiPolygon';
  });

  if (!polygonFeatures.length) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: polygonFeatures,
  };
}

function normalizeCoordinateValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }

  return Number(value.toFixed(6));
}

function normalizeGeometryCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    return normalizeCoordinateValue(coordinates);
  }

  return coordinates.map((item) => normalizeGeometryCoordinates(item));
}

function buildBoundaryGeometrySignature(boundary) {
  const features = extractBoundaryFeatures(boundary);

  const geometrySignatures = features
    .map((feature) => feature?.geometry)
    .filter((geometry) => geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type))
    .map((geometry) =>
      JSON.stringify(
        canonicalizeJsonValue({
          type: geometry.type,
          coordinates: normalizeGeometryCoordinates(geometry.coordinates),
        })
      )
    )
    .sort();

  if (!geometrySignatures.length) {
    return '';
  }

  return JSON.stringify(geometrySignatures);
}

function haveSameBoundaryGeometry(firstBoundary, secondBoundary) {
  const firstSignature = buildBoundaryGeometrySignature(firstBoundary);
  const secondSignature = buildBoundaryGeometrySignature(secondBoundary);

  return Boolean(firstSignature) && firstSignature === secondSignature;
}

function isSameWardData(ward, draftWard) {
  if (!ward) {
    return false;
  }

  return (
    normalizeComparableText(ward.name) === normalizeComparableText(draftWard.name) &&
    normalizeComparableText(ward.description) === normalizeComparableText(draftWard.description) &&
    areJsonValuesEqual(ward.boundary, draftWard.boundary)
  );
}

function statusLabel(status) {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'approved') {
    return 'Approved';
  }

  if (normalizedStatus === 'rejected') {
    return 'Rejected';
  }

  return 'Pending';
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return 'Not available';
  }

  return new Date(dateValue).toLocaleString('en-US');
}

function resolveStatusIcon(status) {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'approved') {
    return approvedIcon;
  }

  if (normalizedStatus === 'rejected') {
    return rejectedIcon;
  }

  return pendingIcon;
}

function hashKey(value) {
  const text = String(value ?? '0');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function resolveCategoryColor(categoryId) {
  const index = hashKey(categoryId) % CATEGORY_PIN_COLORS.length;
  return CATEGORY_PIN_COLORS[index];
}

function resolveCategoryIcon(categoryId) {
  const color = resolveCategoryColor(categoryId);

  if (!categoryIconCache.has(color)) {
    categoryIconCache.set(
      color,
      L.divIcon({
        className: 'admin-venue-pin',
        html: `<span style="background:${color}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
    );
  }

  return categoryIconCache.get(color);
}

function extractBoundaryCenter(boundary) {
  const features = extractBoundaryFeatures(boundary);

  for (const feature of features) {
    const geometry = feature?.geometry;

    if (!geometry) {
      continue;
    }

    if (geometry.type === 'Polygon') {
      const firstPoint = geometry.coordinates?.[0]?.[0];
      if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
        return [Number(firstPoint[1]), Number(firstPoint[0])];
      }
    }

    if (geometry.type === 'MultiPolygon') {
      const firstPoint = geometry.coordinates?.[0]?.[0]?.[0];
      if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
        return [Number(firstPoint[1]), Number(firstPoint[0])];
      }
    }
  }

  return null;
}

function sortCategories(categories) {
  return [...categories].sort((first, second) => String(first.name || '').localeCompare(String(second.name || '')));
}

function sortMerchantServices(services) {
  return [...services].sort((first, second) => {
    const firstOrder = Number(first.sort_order ?? first.sortOrder ?? 0);
    const secondOrder = Number(second.sort_order ?? second.sortOrder ?? 0);

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return String(first.name || '').localeCompare(String(second.name || ''));
  });
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

function normalizeSelectedServiceIds(selectedServices) {
  if (!Array.isArray(selectedServices)) {
    return [];
  }

  return [...new Set(selectedServices.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function extractVenueServiceIds(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  return normalizeSelectedServiceIds(metadata.selectedServices);
}

function resolveVenueServiceNames(venue, serviceNameMap) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const serviceIds = normalizeSelectedServiceIds(metadata.selectedServices);
  const mappedNames = serviceIds.map((serviceId) => serviceNameMap.get(serviceId)).filter(Boolean);

  if (mappedNames.length) {
    return [...new Set(mappedNames)];
  }

  if (!Array.isArray(metadata.selectedServiceNames)) {
    return [];
  }

  return [...new Set(metadata.selectedServiceNames.map((name) => String(name || '').trim()).filter(Boolean))];
}

function normalizeImageUrls(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function extractVenueGalleryImages(venue) {
  const metadata = normalizeVenueMetadata(venue?.metadata);
  const galleryImages = normalizeImageUrls(metadata.galleryImages);
  const fallbackImages = normalizeImageUrls(metadata.images || metadata.imageUrls || metadata.photos);
  const coverImage = typeof venue?.cover_image_url === 'string' ? venue.cover_image_url.trim() : '';

  const merged = [...galleryImages, ...fallbackImages];

  if (coverImage) {
    merged.unshift(coverImage);
  }

  return [...new Set(merged)];
}

function formatCurrencyVnd(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 'Not provided';
  }

  return `${amount.toLocaleString('vi-VN')} VND`;
}

function formatCoordinate(value) {
  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return 'Not provided';
  }

  return coordinate.toFixed(6);
}

function MapViewportController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) {
      return;
    }

    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
}

function AdminBoundaryPage() {
  const [activeMode, setActiveMode] = useState('pending');
  const [wards, setWards] = useState([]);
  const [venues, setVenues] = useState([]);
  const [placeCategories, setPlaceCategories] = useState([]);
  const [merchantServices, setMerchantServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');

  const [submittingWard, setSubmittingWard] = useState(false);
  const [deletingWard, setDeletingWard] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [submittingService, setSubmittingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState(null);
  const [moderatingVenueId, setModeratingVenueId] = useState(null);

  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [isSubmissionDetailClosed, setIsSubmissionDetailClosed] = useState(false);
  const [selectedVenueImageIndex, setSelectedVenueImageIndex] = useState(0);
  const [expandedImageUrl, setExpandedImageUrl] = useState('');

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  const [wardForm, setWardForm] = useState({
    name: '',
    description: '',
    boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
  });
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [serviceNameInput, setServiceNameInput] = useState('');

  const pendingVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() === 'pending'),
    [venues]
  );
  const pendingModeVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() !== 'rejected'),
    [venues]
  );
  const approvedVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() === 'approved'),
    [venues]
  );
  const usageEligibleVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() !== 'rejected'),
    [venues]
  );
  const categoryModeVenues = useMemo(
    () =>
      approvedVenues.filter((venue) => {
        if (!selectedCategoryId) {
          return true;
        }

        return Number(venue.category_id) === Number(selectedCategoryId);
      }),
    [approvedVenues, selectedCategoryId]
  );
  const serviceModeVenues = useMemo(
    () =>
      approvedVenues.filter((venue) => {
        if (!selectedServiceId) {
          return true;
        }

        return extractVenueServiceIds(venue).includes(Number(selectedServiceId));
      }),
    [approvedVenues, selectedServiceId]
  );
  const visibleVenues = useMemo(() => {
    if (activeMode === 'pending') {
      return pendingModeVenues;
    }

    if (activeMode === 'category') {
      return categoryModeVenues;
    }

    if (activeMode === 'service') {
      return serviceModeVenues;
    }

    return approvedVenues;
  }, [activeMode, pendingModeVenues, categoryModeVenues, serviceModeVenues, approvedVenues]);

  const selectedVenue = useMemo(
    () => pendingModeVenues.find((venue) => Number(venue.id) === Number(selectedVenueId)) || null,
    [pendingModeVenues, selectedVenueId]
  );
  const selectedWard = useMemo(
    () => wards.find((ward) => ward.ward_id === selectedWardId) || null,
    [wards, selectedWardId]
  );
  const selectedCategory = useMemo(
    () => placeCategories.find((category) => Number(category.id) === Number(selectedCategoryId)) || null,
    [placeCategories, selectedCategoryId]
  );
  const selectedMerchantService = useMemo(
    () => merchantServices.find((service) => Number(service.id) === Number(selectedServiceId)) || null,
    [merchantServices, selectedServiceId]
  );
  const serviceNameById = useMemo(
    () =>
      new Map(
        merchantServices
          .map((service) => [Number(service.id), String(service.name || '').trim()])
          .filter(([serviceId, serviceName]) => Number.isInteger(serviceId) && serviceId > 0 && Boolean(serviceName))
      ),
    [merchantServices]
  );
  const serviceUsageCountById = useMemo(() => {
    const countById = new Map();

    usageEligibleVenues.forEach((venue) => {
      extractVenueServiceIds(venue).forEach((serviceId) => {
        countById.set(serviceId, (countById.get(serviceId) || 0) + 1);
      });
    });

    return countById;
  }, [usageEligibleVenues]);
  const categoryUsageCountById = useMemo(() => {
    const countById = new Map();

    usageEligibleVenues.forEach((venue) => {
      const categoryId = Number(venue.category_id);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return;
      }

      countById.set(categoryId, (countById.get(categoryId) || 0) + 1);
    });

    return countById;
  }, [usageEligibleVenues]);
  const selectedVenueMetadata = useMemo(() => normalizeVenueMetadata(selectedVenue?.metadata), [selectedVenue]);
  const selectedVenueServiceNames = useMemo(
    () => (selectedVenue ? resolveVenueServiceNames(selectedVenue, serviceNameById) : []),
    [selectedVenue, serviceNameById]
  );
  const selectedVenueGalleryImages = useMemo(
    () => (selectedVenue ? extractVenueGalleryImages(selectedVenue) : []),
    [selectedVenue]
  );
  const selectedVenueActiveImage =
    selectedVenueGalleryImages[selectedVenueImageIndex] || selectedVenueGalleryImages[0] || selectedVenue?.cover_image_url || '';
  const activeModeMeta = PAGE_MODES.find((mode) => mode.value === activeMode);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [wardData, venueData, categoryData, serviceData] = await Promise.all([
        fetchAdminWards(),
        fetchAdminVenues(),
        fetchAdminPlaceCategories(),
        fetchAdminMerchantServices(),
      ]);

      setWards(wardData);
      setVenues(venueData);
      setPlaceCategories(sortCategories(categoryData));
      setMerchantServices(sortMerchantServices(serviceData));
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Could not load map management data.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshWardsAndVenues() {
    const [wardData, venueData] = await Promise.all([fetchAdminWards(), fetchAdminVenues()]);
    setWards(wardData);
    setVenues(venueData);
  }

  async function refreshCategoriesAndVenues() {
    const [categoryData, venueData] = await Promise.all([fetchAdminPlaceCategories(), fetchAdminVenues()]);
    setPlaceCategories(sortCategories(categoryData));
    setVenues(venueData);
  }

  async function refreshMerchantServices() {
    const serviceData = await fetchAdminMerchantServices();
    setMerchantServices(sortMerchantServices(serviceData));
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    if (!pendingModeVenues.length) {
      setSelectedVenueId(null);
      setIsSubmissionDetailClosed(false);
      return;
    }

    const hasSelectedVenue = selectedVenueId
      ? pendingModeVenues.some((venue) => Number(venue.id) === Number(selectedVenueId))
      : false;

    if (!hasSelectedVenue) {
      setSelectedVenueId(null);
    }

    if (isSubmissionDetailClosed) {
      return;
    }

    if (!hasSelectedVenue) {
      const fallbackVenueId = pendingVenues[0]?.id ?? pendingModeVenues[0]?.id ?? null;
      setSelectedVenueId(fallbackVenueId);
    }
  }, [activeMode, pendingModeVenues, pendingVenues, selectedVenueId, isSubmissionDetailClosed]);

  useEffect(() => {
    if (activeMode !== 'pending' || !selectedVenue) {
      return;
    }

    const latitude = Number(selectedVenue.latitude);
    const longitude = Number(selectedVenue.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(15);
    }
  }, [activeMode, selectedVenue]);

  useEffect(() => {
    setSelectedVenueImageIndex(0);
    setExpandedImageUrl('');
  }, [activeMode, selectedVenueId]);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const freshVenues = await fetchAdminVenues();
        setVenues(freshVenues);
      } catch {
        // Polling failures should be silent to avoid disrupting moderation workflow.
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeMode]);

  useEffect(() => {
    if (!selectedWardId) {
      return;
    }

    if (!wards.some((ward) => ward.ward_id === selectedWardId)) {
      setSelectedWardId('');
      setWardForm({
        name: '',
        description: '',
        boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
      });
    }
  }, [selectedWardId, wards]);

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const foundCategory = placeCategories.find((category) => Number(category.id) === Number(selectedCategoryId));
    if (!foundCategory) {
      setSelectedCategoryId(null);
      setCategoryNameInput('');
    }
  }, [placeCategories, selectedCategoryId]);

  useEffect(() => {
    if (!selectedServiceId) {
      return;
    }

    const foundService = merchantServices.find((service) => Number(service.id) === Number(selectedServiceId));
    if (!foundService) {
      setSelectedServiceId(null);
      setServiceNameInput('');
    }
  }, [merchantServices, selectedServiceId]);

  useEffect(() => {
    if (activeMode !== 'category') {
      return;
    }

    if (!selectedCategoryId || !categoryModeVenues.length) {
      return;
    }

    const firstVenue = categoryModeVenues[0];
    const latitude = Number(firstVenue.latitude);
    const longitude = Number(firstVenue.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(13);
    }
  }, [activeMode, selectedCategoryId, categoryModeVenues]);

  useEffect(() => {
    if (activeMode !== 'service') {
      return;
    }

    if (!selectedServiceId && merchantServices.length) {
      const firstService = merchantServices[0];
      setSelectedServiceId(firstService.id);
      setServiceNameInput(firstService.name || '');
      return;
    }

    if (!selectedServiceId || !serviceModeVenues.length) {
      return;
    }

    const firstVenue = serviceModeVenues[0];
    const latitude = Number(firstVenue.latitude);
    const longitude = Number(firstVenue.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setMapCenter([latitude, longitude]);
      setMapZoom(13);
    }
  }, [activeMode, selectedServiceId, serviceModeVenues, merchantServices]);

  function handleModeChange(mode) {
    setActiveMode(mode);
    setError('');
    setOperationMessage('');
    setIsSubmissionDetailClosed(false);

    if (mode === 'pending') {
      const fallbackVenueId = pendingVenues[0]?.id ?? pendingModeVenues[0]?.id ?? null;
      setSelectedVenueId(fallbackVenueId);
    }

    if (mode === 'service' && !selectedServiceId && merchantServices.length) {
      const firstService = merchantServices[0];
      setSelectedServiceId(firstService.id);
      setServiceNameInput(firstService.name || '');
    }
  }

  function loadWardToEditor(ward) {
    setSelectedWardId(ward.ward_id);
    setWardForm({
      name: ward.name || '',
      description: ward.description || '',
      boundaryJson: JSON.stringify(ward.boundary, null, 2),
    });

    const center = extractBoundaryCenter(ward.boundary);
    if (center) {
      setMapCenter(center);
      setMapZoom(14);
    }
  }

  function prepareAddWard() {
    setSelectedWardId('');
    setWardForm({
      name: '',
      description: '',
      boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
    });
  }

  function handleWardInputChange(event) {
    const { name, value } = event.target;
    setWardForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleBoundaryFileLoad(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setWardForm((currentForm) => ({
        ...currentForm,
        boundaryJson: String(reader.result || ''),
      }));
    };
    reader.readAsText(file);
  }

  async function handleSaveWard(mode) {
    setError('');
    setOperationMessage('');

    const name = wardForm.name.trim();
    if (!name) {
      setError('Ward name is required.');
      return;
    }

    let parsedBoundary;
    try {
      parsedBoundary = JSON.parse(wardForm.boundaryJson || '{}');
    } catch {
      setError('Invalid GeoJSON format. Please check your boundary JSON.');
      return;
    }

    const normalizedDescription = wardForm.description.trim();
    const wardDraft = {
      name,
      description: normalizedDescription,
      boundary: parsedBoundary,
    };

    if (mode === 'update' && !selectedWardId) {
      setError('Select a ward boundary first before updating.');
      return;
    }

    if (mode === 'update') {
      if (!selectedWard) {
        setError('Selected ward no longer exists. Please select a ward again.');
        return;
      }

      if (isSameWardData(selectedWard, wardDraft)) {
        setError('No changes detected. Please edit ward data before updating.');
        return;
      }

      const duplicatedBoundaryWard = wards.find(
        (ward) => ward.ward_id !== selectedWardId && haveSameBoundaryGeometry(ward.boundary, parsedBoundary)
      );

      if (duplicatedBoundaryWard) {
        setError(`This GeoJSON boundary already exists in ward "${duplicatedBoundaryWard.name}".`);
        return;
      }
    }

    if (mode === 'add') {
      const duplicatedBoundaryWard = wards.find((ward) => haveSameBoundaryGeometry(ward.boundary, parsedBoundary));

      if (duplicatedBoundaryWard) {
        setError(`This GeoJSON boundary already exists in ward "${duplicatedBoundaryWard.name}".`);
        return;
      }
    }

    setSubmittingWard(true);

    try {
      const payload = {
        name,
        description: normalizedDescription,
        boundary: parsedBoundary,
      };

      if (mode === 'update') {
        payload.wardId = selectedWardId;
      }

      const savedWard = await upsertAdminWard(payload);
      await refreshWardsAndVenues();
      loadWardToEditor(savedWard);

      setOperationMessage(mode === 'update' ? 'Ward updated successfully.' : 'Ward added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not save ward data.');
    } finally {
      setSubmittingWard(false);
    }
  }

  async function handleDeleteWard() {
    if (!selectedWardId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete ward "${selectedWard?.name || selectedWardId}"?`);

    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingWard(true);

    try {
      await deleteAdminWard(selectedWardId);
      await refreshWardsAndVenues();
      prepareAddWard();
      setOperationMessage('Ward deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete ward.');
    } finally {
      setDeletingWard(false);
    }
  }

  function loadCategoryToEditor(category) {
    setSelectedCategoryId(category.id);
    setCategoryNameInput(category.name || '');
  }

  async function handleAddCategory() {
    const name = categoryNameInput.trim();

    if (!name) {
      setError('Category name is required.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const created = await createAdminPlaceCategory({
        name,
        slug: slugifyText(name),
      });

      await refreshCategoriesAndVenues();
      setSelectedCategoryId(created.id);
      setCategoryNameInput(created.name || name);
      setOperationMessage('Category added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not add category.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleUpdateCategory() {
    if (!selectedCategoryId) {
      setError('Select a category first before updating.');
      return;
    }

    if (!selectedCategory) {
      setError('Selected category no longer exists. Please select a category again.');
      return;
    }

    const name = categoryNameInput.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }

    if (normalizeComparableText(selectedCategory.name) === name) {
      setError('No changes detected. Please edit category name before updating.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingCategory(true);

    try {
      const updated = await updateAdminPlaceCategory(selectedCategoryId, {
        name,
      });

      await refreshCategoriesAndVenues();
      setCategoryNameInput(updated.name || name);
      setOperationMessage('Category updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Could not update category.');
    } finally {
      setSubmittingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategoryId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete category "${selectedCategory?.name || categoryNameInput}"?`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingCategoryId(selectedCategoryId);

    try {
      await deleteAdminPlaceCategory(selectedCategoryId);
      await refreshCategoriesAndVenues();

      setSelectedCategoryId(null);
      setCategoryNameInput('');
      setOperationMessage('Category deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete category.');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  function loadServiceToEditor(service) {
    setSelectedServiceId(service.id);
    setServiceNameInput(service.name || '');
  }

  async function handleAddService() {
    const name = serviceNameInput.trim();

    if (!name) {
      setError('Service name is required.');
      return;
    }

    const nextSortOrder = merchantServices.reduce((maxOrder, service) => {
      const serviceOrder = Number(service.sort_order ?? service.sortOrder ?? 0);
      return Number.isFinite(serviceOrder) ? Math.max(maxOrder, serviceOrder) : maxOrder;
    }, 0) + 10;

    setError('');
    setOperationMessage('');
    setSubmittingService(true);

    try {
      const created = await createAdminMerchantService({
        name,
        slug: slugifyText(name),
        sortOrder: nextSortOrder,
      });

      await refreshMerchantServices();
      setSelectedServiceId(created.id);
      setServiceNameInput(created.name || name);
      setOperationMessage('Service added successfully.');
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not add service.');
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleUpdateService() {
    if (!selectedServiceId) {
      setError('Select a service first before updating.');
      return;
    }

    if (!selectedMerchantService) {
      setError('Selected service no longer exists. Please select a service again.');
      return;
    }

    const name = serviceNameInput.trim();
    if (!name) {
      setError('Service name is required.');
      return;
    }

    if (normalizeComparableText(selectedMerchantService.name) === name) {
      setError('No changes detected. Please edit service name before updating.');
      return;
    }

    setError('');
    setOperationMessage('');
    setSubmittingService(true);

    try {
      const updated = await updateAdminMerchantService(selectedServiceId, {
        name,
      });

      await refreshMerchantServices();
      setServiceNameInput(updated.name || name);
      setOperationMessage('Service updated successfully.');
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Could not update service.');
    } finally {
      setSubmittingService(false);
    }
  }

  async function handleDeleteService() {
    if (!selectedServiceId) {
      return;
    }

    const shouldDelete = window.confirm(`Delete service "${selectedMerchantService?.name || serviceNameInput}"?`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setOperationMessage('');
    setDeletingServiceId(selectedServiceId);

    try {
      await deleteAdminMerchantService(selectedServiceId);
      await refreshMerchantServices();

      setSelectedServiceId(null);
      setServiceNameInput('');
      setOperationMessage('Service deleted successfully.');
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete service.');
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleModeration(venueId, action) {
    const venueToModerate = venues.find((item) => Number(item.id) === Number(venueId));
    const venueDisplayName = venueToModerate?.title || venueToModerate?.name || `#${venueId}`;
    const confirmationMessage =
      action === 'approve'
        ? `Approve post "${venueDisplayName}"? This will add this location to the approved map.`
        : `Reject post "${venueDisplayName}"? This will permanently remove this location from the database.`;

    const shouldProceed = window.confirm(confirmationMessage);

    if (!shouldProceed) {
      return;
    }

    setError('');
    setOperationMessage('');

    const rejectionReason = rejectReasons[venueId] || '';
    setModeratingVenueId(venueId);

    try {
      const response = await moderateAdminVenue(venueId, {
        action,
        rejectionReason,
      });

      if (action === 'reject') {
        const deletedVenueId = Number(response.deletedVenueId ?? venueId);

        setVenues((currentVenues) => currentVenues.filter((item) => Number(item.id) !== deletedVenueId));
        setRejectReasons((currentReasons) => ({
          ...currentReasons,
          [venueId]: '',
        }));
      } else if (response.venue) {
        const updatedVenue = response.venue;
        setVenues((currentVenues) =>
          currentVenues.map((item) => (Number(item.id) === Number(updatedVenue.id) ? updatedVenue : item))
        );
      }

      setOperationMessage(response.message || 'Moderation status updated.');
    } catch (moderateError) {
      setError(moderateError.response?.data?.message || 'Could not update moderation status.');
    } finally {
      setModeratingVenueId(null);
    }
  }

  function handleOpenVenueDetails(venueId) {
    setIsSubmissionDetailClosed(false);
    setSelectedVenueId(venueId);
    setSelectedVenueImageIndex(0);
    setExpandedImageUrl('');
  }

  function handlePreviousVenueImage() {
    if (selectedVenueGalleryImages.length <= 1) {
      return;
    }

    setSelectedVenueImageIndex((currentIndex) =>
      currentIndex === 0 ? selectedVenueGalleryImages.length - 1 : currentIndex - 1
    );
  }

  function handleNextVenueImage() {
    if (selectedVenueGalleryImages.length <= 1) {
      return;
    }

    setSelectedVenueImageIndex((currentIndex) => (currentIndex + 1) % selectedVenueGalleryImages.length);
  }

  function resolveMarkerIcon(venue) {
    if (activeMode === 'category') {
      return resolveCategoryIcon(venue.category_id);
    }

    return resolveStatusIcon(venue.status);
  }

  function renderLeftPanel() {
    if (activeMode === 'pending') {
      return (
        <div className="admin-list-panel">
          <header>
            <h3>Pending Queue</h3>
            <p>{pendingVenues.length} waiting submission(s)</p>
          </header>

          <div className="admin-scroll-list">
            {pendingVenues.map((venue) => (
              <button
                key={venue.id}
                type="button"
                className={`admin-list-item ${Number(selectedVenueId) === Number(venue.id) ? 'is-active' : ''}`.trim()}
                onClick={() => handleOpenVenueDetails(venue.id)}
              >
                <strong>{venue.title || venue.name}</strong>
                <span>{venue.address || 'Address pending'}</span>
                <small>{formatDateTime(venue.submitted_at)}</small>
              </button>
            ))}

            {!pendingVenues.length ? <p className="admin-empty-note">No pending posts right now.</p> : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'ward') {
      return (
        <div className="admin-list-panel">
          <header>
            <h3>Ward Boundaries</h3>
            <p>Click from this list or click a polygon directly on the map.</p>
          </header>

          <div className="admin-scroll-list">
            {wards.map((ward) => (
              <button
                key={ward.ward_id}
                type="button"
                className={`admin-list-item ${selectedWardId === ward.ward_id ? 'is-active' : ''}`.trim()}
                onClick={() => loadWardToEditor(ward)}
              >
                <strong>{ward.name}</strong>
                <small>{formatDateTime(ward.updated_at || ward.created_at)}</small>
              </button>
            ))}

            {!wards.length ? <p className="admin-empty-note">No wards available yet.</p> : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'service') {
      return (
        <div className="admin-list-panel">
          <header>
            <h3>Merchant Services</h3>
            <p>{merchantServices.length} service option(s)</p>
          </header>

          <div className="admin-scroll-list">
            {merchantServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`admin-list-item ${Number(selectedServiceId) === Number(service.id) ? 'is-active' : ''}`.trim()}
                onClick={() => loadServiceToEditor(service)}
              >
                <strong>{service.name}</strong>
                <span>{serviceUsageCountById.get(Number(service.id)) || 0} venue(s) using this service</span>
                <small>{service.slug}</small>
              </button>
            ))}

            {!merchantServices.length ? <p className="admin-empty-note">No merchant services yet.</p> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="admin-list-panel">
        <header>
          <h3>Place Categories</h3>
          <p>Click one category to preview matching markers on the map.</p>
        </header>

        <div className="admin-scroll-list">
          {placeCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`admin-list-item ${Number(selectedCategoryId) === Number(category.id) ? 'is-active' : ''}`.trim()}
              onClick={() => loadCategoryToEditor(category)}
            >
              <strong>
                <span className="category-color-dot" style={{ backgroundColor: resolveCategoryColor(category.id) }} />
                {category.name}
              </strong>
                <span>{categoryUsageCountById.get(Number(category.id)) || 0} venue(s) using this category</span>
            </button>
          ))}

          {!placeCategories.length ? <p className="admin-empty-note">No categories yet.</p> : null}
        </div>
      </div>
    );
  }

  function renderRightPanel() {
    if (activeMode === 'pending') {
      const selectedVenueStatus = String(selectedVenue?.status || '').toLowerCase();

      return (
        <div className="admin-detail-panel">
          <header className="admin-detail-panel-header">
            <div className="admin-detail-panel-header-text">
              <h3>Submission Detail</h3>
              <p>Review selected post and decide moderation action.</p>
            </div>

            {selectedVenue ? (
              <button
                type="button"
                className="admin-detail-close-btn"
                onClick={() => {
                  setIsSubmissionDetailClosed(true);
                  setSelectedVenueId(null);
                  setExpandedImageUrl('');
                }}
                aria-label="Close submission detail"
              >
                ×
              </button>
            ) : null}
          </header>

          {!selectedVenue ? (
            <p className="admin-empty-note">Select a pending post from the queue.</p>
          ) : (
            <div className="admin-detail-stack">
              {selectedVenueActiveImage ? (
                <div className="admin-image-carousel">
                  <button
                    type="button"
                    className="admin-carousel-btn"
                    onClick={handlePreviousVenueImage}
                    disabled={selectedVenueGalleryImages.length <= 1}
                    aria-label="Show previous image"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    className="admin-carousel-image-wrap"
                    onClick={() => setExpandedImageUrl(selectedVenueActiveImage)}
                    aria-label="Open image preview"
                  >
                    <img
                      src={selectedVenueActiveImage}
                      alt={selectedVenue.title || selectedVenue.name}
                      className="admin-detail-image admin-detail-image-clickable"
                    />
                  </button>

                  <button
                    type="button"
                    className="admin-carousel-btn"
                    onClick={handleNextVenueImage}
                    disabled={selectedVenueGalleryImages.length <= 1}
                    aria-label="Show next image"
                  >
                    ›
                  </button>

                  <p className="admin-carousel-counter">
                    {Math.min(selectedVenueImageIndex + 1, Math.max(selectedVenueGalleryImages.length, 1))}
                    {' / '}
                    {Math.max(selectedVenueGalleryImages.length, 1)}
                  </p>
                </div>
              ) : (
                <div className="admin-detail-image-placeholder">No cover image</div>
              )}

              <h4>{selectedVenue.title || selectedVenue.name}</h4>
              <p>{selectedVenue.address || 'Address pending'}</p>

              <div className="admin-extra-detail-block">
                <ul className="admin-detail-meta">
                  <li>Venue ID: {selectedVenue.id}</li>
                  <li>Name: {selectedVenue.name || 'Not provided'}</li>
                  <li>Ward: {selectedVenue.ward_name || selectedVenue.ward_id || 'Not detected'}</li>
                  <li>Category: {selectedVenue.category_name || 'Uncategorized'}</li>
                  <li>Status: {statusLabel(selectedVenue.status)}</li>
                  <li>Phone: {selectedVenue.phone || 'Not provided'}</li>
                  <li>Submitted: {formatDateTime(selectedVenue.submitted_at)}</li>
                  <li>Latitude: {formatCoordinate(selectedVenue.latitude)}</li>
                  <li>Longitude: {formatCoordinate(selectedVenue.longitude)}</li>
                  <li>
                    Price range:
                    {' '}
                    {formatCurrencyVnd(selectedVenueMetadata.minPrice)} - {formatCurrencyVnd(selectedVenueMetadata.maxPrice)}
                  </li>
                  <li>
                    Operating hours:
                    {' '}
                    {selectedVenueMetadata.startTime && selectedVenueMetadata.endTime
                      ? `${selectedVenueMetadata.startTime} - ${selectedVenueMetadata.endTime}`
                      : 'Not provided'}
                  </li>
                  <li>Gallery images: {selectedVenueGalleryImages.length || 0}</li>
                  <li>Business license: {selectedVenue.business_license_image_url ? 'Uploaded' : 'Missing'}</li>
                </ul>

                {selectedVenue.description ? <p>{selectedVenue.description}</p> : null}

                <div className="admin-service-summary">
                  <strong>Services offered</strong>
                  {selectedVenueServiceNames.length ? (
                    <div className="admin-service-chip-list">
                      {selectedVenueServiceNames.map((serviceName) => (
                        <span key={serviceName} className="admin-service-chip">
                          {serviceName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty-note">No services selected by merchant.</p>
                  )}
                </div>

                {selectedVenue.business_license_image_url ? (
                  <div className="admin-license-preview">
                    <p>Business license preview</p>
                    <button
                      type="button"
                      className="admin-license-image-wrap"
                      onClick={() => setExpandedImageUrl(selectedVenue.business_license_image_url)}
                    >
                      <img
                        src={selectedVenue.business_license_image_url}
                        alt={`${selectedVenue.title || selectedVenue.name} license`}
                        className="admin-detail-image admin-detail-image-clickable"
                      />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="admin-form-field">
                <label htmlFor="rejectionReason">Rejection Reason (Optional)</label>
                <textarea
                  id="rejectionReason"
                  value={rejectReasons[selectedVenue.id] || ''}
                  onChange={(event) =>
                    setRejectReasons((currentReasons) => ({
                      ...currentReasons,
                      [selectedVenue.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional note when rejecting this post."
                />
              </div>

              <div className="admin-action-row">
                {selectedVenueStatus !== 'approved' ? (
                  <button
                    type="button"
                    className="action-approve"
                    disabled={moderatingVenueId === selectedVenue.id}
                    onClick={() => handleModeration(selectedVenue.id, 'approve')}
                  >
                    {moderatingVenueId === selectedVenue.id ? 'Updating...' : 'Approve Post'}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="action-reject"
                  disabled={moderatingVenueId === selectedVenue.id}
                  onClick={() => handleModeration(selectedVenue.id, 'reject')}
                >
                  Reject Post
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeMode === 'ward') {
      return (
        <div className="admin-detail-panel">
          <header>
            <h3>Ward Naming</h3>
            <p>
              {selectedWardId
                ? 'Selected ward detected. You can add, update, or delete from this panel.'
                : 'No ward selected. Fill the form and click Add Ward.'}
            </p>
          </header>

          <div className="admin-form-stack">
            <div className="admin-form-field">
              <label htmlFor="wardName">Ward Name</label>
              <input
                id="wardName"
                name="name"
                value={wardForm.name}
                onChange={handleWardInputChange}
                placeholder="e.g. Hai Chau"
                required
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="wardDescription">Description</label>
              <textarea
                id="wardDescription"
                name="description"
                value={wardForm.description}
                onChange={handleWardInputChange}
                rows={2}
                placeholder="Short description for this ward"
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="boundaryJson">Boundary GeoJSON</label>
              <textarea
                id="boundaryJson"
                name="boundaryJson"
                value={wardForm.boundaryJson}
                onChange={handleWardInputChange}
                rows={8}
                placeholder={EMPTY_BOUNDARY_TEMPLATE}
                required
              />
            </div>

            <div className="admin-upload-wrap">
              <input type="file" accept=".json,.geojson,application/json" onChange={handleBoundaryFileLoad} />
            </div>

            {selectedWardId ? (
              <div className="admin-action-row">
                <button type="button" className="action-secondary" disabled={submittingWard} onClick={() => handleSaveWard('add')}>
                  {submittingWard ? 'Processing...' : 'Add Ward'}
                </button>

                <button type="button" className="action-primary" disabled={submittingWard} onClick={() => handleSaveWard('update')}>
                  {submittingWard ? 'Processing...' : 'Update Ward'}
                </button>

                <button type="button" className="action-danger" disabled={deletingWard} onClick={handleDeleteWard}>
                  {deletingWard ? 'Deleting...' : 'Delete Ward'}
                </button>
              </div>
            ) : (
              <div className="admin-action-row">
                <button type="button" className="action-primary" disabled={submittingWard} onClick={() => handleSaveWard('add')}>
                  {submittingWard ? 'Adding...' : 'Add Ward'}
                </button>
              </div>
            )}

            {selectedWardId ? (
              <button type="button" className="action-link" onClick={prepareAddWard}>
                Clear selection and create a new ward
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    if (activeMode === 'service') {
      return (
        <div className="admin-detail-panel">
          <header>
            <h3>Services Offered - Merchant</h3>
            <p>Manage service options shown in the merchant registration form.</p>
          </header>

          <div className="admin-form-stack">
            <div className="admin-form-field">
              <label htmlFor="merchantServiceName">Service Name</label>
              <input
                id="merchantServiceName"
                value={serviceNameInput}
                onChange={(event) => setServiceNameInput(event.target.value)}
                placeholder="e.g. Family Room"
              />
            </div>

            <div className="admin-action-row">
              <button type="button" className="action-primary" disabled={submittingService} onClick={handleAddService}>
                {submittingService ? 'Processing...' : 'Add'}
              </button>

              <button
                type="button"
                className="action-secondary"
                disabled={!selectedServiceId || submittingService}
                onClick={handleUpdateService}
              >
                {submittingService ? 'Processing...' : 'Update'}
              </button>

              <button
                type="button"
                className="action-danger"
                disabled={!selectedServiceId || deletingServiceId === selectedServiceId}
                onClick={handleDeleteService}
              >
                {deletingServiceId === selectedServiceId ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            {selectedMerchantService ? (
              <p className="admin-inline-note">
                Selected service:
                <strong>{selectedMerchantService.name}</strong>
                <span>
                  ({serviceUsageCountById.get(Number(selectedMerchantService.id)) || 0} venue(s) use this option)
                </span>
              </p>
            ) : (
              <p className="admin-inline-note">Select a service from the left list to update or delete it.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="admin-detail-panel">
        <header>
          <h3>Place Categories</h3>
          <p>One shared list for Merchant category dropdown and User category filters.</p>
        </header>

        <div className="admin-form-stack">
          <div className="admin-form-field">
            <label htmlFor="placeCategoryName">Category Name</label>
            <input
              id="placeCategoryName"
              value={categoryNameInput}
              onChange={(event) => setCategoryNameInput(event.target.value)}
              placeholder="e.g. Entertainment Venue"
            />
          </div>

          <div className="admin-action-row">
            <button type="button" className="action-primary" disabled={submittingCategory} onClick={handleAddCategory}>
              {submittingCategory ? 'Processing...' : 'Add'}
            </button>

            <button
              type="button"
              className="action-secondary"
              disabled={!selectedCategoryId || submittingCategory}
              onClick={handleUpdateCategory}
            >
              {submittingCategory ? 'Processing...' : 'Update'}
            </button>

            <button
              type="button"
              className="action-danger"
              disabled={!selectedCategoryId || deletingCategoryId === selectedCategoryId}
              onClick={handleDeleteCategory}
            >
              {deletingCategoryId === selectedCategoryId ? 'Deleting...' : 'Delete'}
            </button>
          </div>

          {selectedCategory ? (
            <p className="admin-inline-note">
              Selected category:
              <span className="category-color-dot" style={{ backgroundColor: resolveCategoryColor(selectedCategory.id) }} />
              {selectedCategory.name}
              <span>({categoryUsageCountById.get(Number(selectedCategory.id)) || 0} venue(s) use this category)</span>
            </p>
          ) : (
            <p className="admin-inline-note">Select a category from the list to update or delete it.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-map-page">
      <SectionCard
        className="admin-map-section-card"
        eyebrow="Admin Map Management"
        title="Map Moderation Workspace"
        description="Manage pending posts, ward boundaries, place categories, and merchant services without affecting other modules."
      >
        {operationMessage ? <div className="admin-map-message success">{operationMessage}</div> : null}
        {error ? <div className="admin-map-message error">{error}</div> : null}

        <div className="admin-mode-tabs" role="tablist" aria-label="Admin map modes">
          {PAGE_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`admin-mode-tab ${activeMode === mode.value ? 'is-active' : ''}`.trim()}
              onClick={() => handleModeChange(mode.value)}
            >
              <strong>{mode.label}</strong>
              <span>{mode.helper}</span>
            </button>
          ))}
        </div>

        <p className="admin-mode-helper">{activeModeMeta?.helper}</p>

        <div className="admin-workspace-grid">
          <aside className="admin-workspace-panel left">{renderLeftPanel()}</aside>

          <section className="admin-map-canvas">
            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
              <MapViewportController center={mapCenter} zoom={mapZoom} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              {wards.map((ward) => {
                const polygonBoundary = toPolygonBoundaryFeatureCollection(ward.boundary);

                if (!polygonBoundary) {
                  return null;
                }

                return (
                  <GeoJSON
                    key={`${ward.ward_id}-${ward.updated_at || ward.created_at || ''}`}
                    data={polygonBoundary}
                    style={{
                      color: selectedWardId === ward.ward_id ? '#f25f29' : '#155e63',
                      weight: selectedWardId === ward.ward_id ? 3 : 2,
                      fillOpacity: selectedWardId === ward.ward_id ? 0.24 : 0.08,
                    }}
                    eventHandlers={
                      activeMode === 'ward'
                        ? {
                            click: () => loadWardToEditor(ward),
                          }
                        : undefined
                    }
                  >
                    <Tooltip sticky>
                      <span>{ward.name}</span>
                    </Tooltip>
                  </GeoJSON>
                );
              })}

              {visibleVenues
                .filter((venue) => Number.isFinite(Number(venue.latitude)) && Number.isFinite(Number(venue.longitude)))
                .map((venue) => (
                  <Marker
                    key={venue.id}
                    position={[Number(venue.latitude), Number(venue.longitude)]}
                    icon={resolveMarkerIcon(venue)}
                    eventHandlers={
                      activeMode === 'pending'
                        ? {
                            click: () => handleOpenVenueDetails(venue.id),
                          }
                        : undefined
                    }
                  >
                    <Popup>
                      <div className="admin-map-popup">
                        {venue.cover_image_url ? (
                          <img src={venue.cover_image_url} alt={venue.name} className="admin-map-popup-image" />
                        ) : (
                          <div className="admin-map-popup-image-placeholder">No cover image</div>
                        )}

                        <h3>{venue.title || venue.name}</h3>
                        <p>{venue.address || 'Address pending'}</p>
                        <ul>
                          <li>Ward: {venue.ward_name || venue.ward_id || 'Not detected'}</li>
                          <li>Category: {venue.category_name || 'Uncategorized'}</li>
                          <li>Status: {statusLabel(venue.status)}</li>
                          <li>Phone: {venue.phone || 'Not provided'}</li>
                        </ul>
                        {venue.description ? <p className="admin-map-popup-description">{venue.description}</p> : null}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>

            {loading ? <div className="admin-map-overlay">Loading map management data...</div> : null}
          </section>

          <aside className="admin-workspace-panel right">{renderRightPanel()}</aside>
        </div>

        {expandedImageUrl ? (
          <div className="admin-image-lightbox" role="dialog" aria-modal="true" onClick={() => setExpandedImageUrl('')}>
            <button
              type="button"
              className="admin-lightbox-close"
              onClick={() => setExpandedImageUrl('')}
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={expandedImageUrl}
              alt="Expanded venue"
              className="admin-lightbox-image"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export default AdminBoundaryPage;

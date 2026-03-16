import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SectionCard from '../../components/common/SectionCard';
import {
  createAdminPlaceCategory,
  deleteAdminPlaceCategory,
  deleteAdminWard,
  fetchAdminPlaceCategories,
  fetchAdminVenues,
  fetchAdminWards,
  moderateAdminVenue,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');

  const [submittingWard, setSubmittingWard] = useState(false);
  const [deletingWard, setDeletingWard] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [moderatingVenueId, setModeratingVenueId] = useState(null);

  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  const [wardForm, setWardForm] = useState({
    name: '',
    description: '',
    boundaryJson: EMPTY_BOUNDARY_TEMPLATE,
  });
  const [categoryNameInput, setCategoryNameInput] = useState('');

  const pendingVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() === 'pending'),
    [venues]
  );
  const approvedVenues = useMemo(
    () => venues.filter((venue) => String(venue.status || '').toLowerCase() === 'approved'),
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
  const visibleVenues = useMemo(() => {
    if (activeMode === 'pending') {
      return pendingVenues;
    }

    if (activeMode === 'category') {
      return categoryModeVenues;
    }

    return approvedVenues;
  }, [activeMode, pendingVenues, categoryModeVenues, approvedVenues]);

  const selectedVenue = useMemo(
    () => pendingVenues.find((venue) => Number(venue.id) === Number(selectedVenueId)) || null,
    [pendingVenues, selectedVenueId]
  );
  const selectedWard = useMemo(
    () => wards.find((ward) => ward.ward_id === selectedWardId) || null,
    [wards, selectedWardId]
  );
  const selectedCategory = useMemo(
    () => placeCategories.find((category) => Number(category.id) === Number(selectedCategoryId)) || null,
    [placeCategories, selectedCategoryId]
  );
  const activeModeMeta = PAGE_MODES.find((mode) => mode.value === activeMode);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [wardData, venueData, categoryData] = await Promise.all([
        fetchAdminWards(),
        fetchAdminVenues(),
        fetchAdminPlaceCategories(),
      ]);

      setWards(wardData);
      setVenues(venueData);
      setPlaceCategories(sortCategories(categoryData));
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeMode !== 'pending') {
      return;
    }

    if (!pendingVenues.length) {
      setSelectedVenueId(null);
      return;
    }

    if (!selectedVenueId || !pendingVenues.some((venue) => Number(venue.id) === Number(selectedVenueId))) {
      setSelectedVenueId(pendingVenues[0].id);
    }
  }, [activeMode, pendingVenues, selectedVenueId]);

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

  function handleModeChange(mode) {
    setActiveMode(mode);
    setError('');
    setOperationMessage('');

    if (mode === 'pending' && pendingVenues.length) {
      setSelectedVenueId(pendingVenues[0].id);
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

  async function handleModeration(venueId, action) {
    setError('');
    setOperationMessage('');

    const rejectionReason = rejectReasons[venueId] || '';
    setModeratingVenueId(venueId);

    try {
      const response = await moderateAdminVenue(venueId, {
        action,
        rejectionReason,
      });

      const updatedVenue = response.venue;
      setVenues((currentVenues) =>
        currentVenues.map((item) => (Number(item.id) === Number(updatedVenue.id) ? updatedVenue : item))
      );

      if (action === 'reject') {
        setRejectReasons((currentReasons) => ({
          ...currentReasons,
          [venueId]: '',
        }));
      }

      setOperationMessage(response.message || 'Moderation status updated.');
    } catch (moderateError) {
      setError(moderateError.response?.data?.message || 'Could not update moderation status.');
    } finally {
      setModeratingVenueId(null);
    }
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
                onClick={() => setSelectedVenueId(venue.id)}
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
            </button>
          ))}

          {!placeCategories.length ? <p className="admin-empty-note">No categories yet.</p> : null}
        </div>
      </div>
    );
  }

  function renderRightPanel() {
    if (activeMode === 'pending') {
      return (
        <div className="admin-detail-panel">
          <header>
            <h3>Submission Detail</h3>
            <p>Review selected post and decide moderation action.</p>
          </header>

          {!selectedVenue ? (
            <p className="admin-empty-note">Select a pending post from the queue.</p>
          ) : (
            <div className="admin-detail-stack">
              {selectedVenue.cover_image_url ? (
                <img
                  src={selectedVenue.cover_image_url}
                  alt={selectedVenue.title || selectedVenue.name}
                  className="admin-detail-image"
                />
              ) : (
                <div className="admin-detail-image-placeholder">No cover image</div>
              )}

              <h4>{selectedVenue.title || selectedVenue.name}</h4>
              <p>{selectedVenue.address || 'Address pending'}</p>

              <ul className="admin-detail-meta">
                <li>Ward: {selectedVenue.ward_name || selectedVenue.ward_id || 'Not detected'}</li>
                <li>Category: {selectedVenue.category_name || 'Uncategorized'}</li>
                <li>Phone: {selectedVenue.phone || 'Not provided'}</li>
                <li>Submitted: {formatDateTime(selectedVenue.submitted_at)}</li>
              </ul>

              {selectedVenue.description ? <p>{selectedVenue.description}</p> : null}

              <div className="admin-form-field">
                <label htmlFor="rejectionReason">Rejection Reason</label>
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
                  placeholder="Required only when rejecting this post."
                />
              </div>

              <div className="admin-action-row">
                <button
                  type="button"
                  className="action-approve"
                  disabled={moderatingVenueId === selectedVenue.id}
                  onClick={() => handleModeration(selectedVenue.id, 'approve')}
                >
                  {moderatingVenueId === selectedVenue.id ? 'Updating...' : 'Approve Post'}
                </button>

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
              placeholder="e.g. Khu vui choi"
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
              Selected category color:
              <span className="category-color-dot" style={{ backgroundColor: resolveCategoryColor(selectedCategory.id) }} />
              {selectedCategory.name}
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
        description="Manage pending posts, ward boundaries, and place categories without affecting other modules."
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

              {wards.map((ward) => (
                <GeoJSON
                  key={`${ward.ward_id}-${ward.updated_at || ward.created_at || ''}`}
                  data={ward.boundary}
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
              ))}

              {visibleVenues.map((venue) => (
                <Marker
                  key={venue.id}
                  position={[Number(venue.latitude), Number(venue.longitude)]}
                  icon={resolveMarkerIcon(venue)}
                  eventHandlers={
                    activeMode === 'pending'
                      ? {
                          click: () => setSelectedVenueId(venue.id),
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
      </SectionCard>
    </div>
  );
}

export default AdminBoundaryPage;

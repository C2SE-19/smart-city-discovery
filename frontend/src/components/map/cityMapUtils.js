export const DEFAULT_CITY_CENTER = [16.0471, 108.2068];

export function normalizeVenueMetadata(metadata) {
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

export function normalizeBoundary(boundary) {
  if (!boundary) {
    return null;
  }

  if (typeof boundary === 'string') {
    try {
      return JSON.parse(boundary);
    } catch {
      return null;
    }
  }

  if (typeof boundary === 'object') {
    return boundary;
  }

  return null;
}

const GEOJSON_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

function isGeometryObject(value) {
  return Boolean(value && typeof value === 'object' && GEOJSON_GEOMETRY_TYPES.has(value.type));
}

function normalizeGeometryFeature(feature) {
  if (!feature || feature.type !== 'Feature' || !isGeometryObject(feature.geometry)) {
    return null;
  }

  return {
    ...feature,
    properties: feature.properties && typeof feature.properties === 'object' ? feature.properties : {},
  };
}

export function toValidBoundaryFeatureCollection(boundary) {
  const parsed = normalizeBoundary(boundary);

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    const validFeatures = parsed.features.map((feature) => normalizeGeometryFeature(feature)).filter(Boolean);
    return validFeatures.length ? { type: 'FeatureCollection', features: validFeatures } : null;
  }

  if (parsed.type === 'Feature') {
    const normalizedFeature = normalizeGeometryFeature(parsed);
    return normalizedFeature ? { type: 'FeatureCollection', features: [normalizedFeature] } : null;
  }

  if (isGeometryObject(parsed)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: parsed }],
    };
  }

  return null;
}

export function normalizeWards(rawWards) {
  if (!Array.isArray(rawWards)) {
    return [];
  }

  return rawWards
    .map((ward) => ({
      ...ward,
      boundary: toValidBoundaryFeatureCollection(ward.boundary),
    }))
    .filter((ward) => ward.boundary);
}

export function normalizeVenues(rawVenues) {
  if (!Array.isArray(rawVenues)) {
    return [];
  }

  return rawVenues
    .map((venue) => {
      const latitude = Number(venue.latitude);
      const longitude = Number(venue.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        ...venue,
        latitude,
        longitude,
      };
    })
    .filter(Boolean);
}

export function resolveVenueName(venue) {
  return venue.name || venue.title || 'Untitled venue';
}

export function resolveWardName(venue) {
  return venue.ward_name || venue.wardName || 'Unknown ward';
}

export function resolveVenueCategoryId(venue) {
  const categoryId = Number(venue.category_id ?? venue.categoryId);
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
}

export function resolveVenueCategoryName(venue) {
  return venue.category_name || venue.categoryName || 'Uncategorized';
}

export function extractVenueServiceNames(venue, serviceNameById) {
  const metadata = normalizeVenueMetadata(venue.metadata);

  const selectedByName = Array.isArray(metadata.selectedServiceNames)
    ? metadata.selectedServiceNames
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];

  if (selectedByName.length) {
    return [...new Set(selectedByName)];
  }

  if (!Array.isArray(metadata.selectedServices)) {
    return [];
  }

  const selectedById = metadata.selectedServices
    .map((serviceId) => Number(serviceId))
    .filter((serviceId) => Number.isInteger(serviceId) && serviceId > 0)
    .map((serviceId) => serviceNameById.get(serviceId))
    .filter(Boolean);

  return [...new Set(selectedById)];
}

export function extractVenueWeeklySchedule(venue) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const source = metadata.weeklySchedule;

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return [];
  }

  const orderedDays = [
    ['monday', 'Monday'],
    ['tuesday', 'Tuesday'],
    ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'],
    ['friday', 'Friday'],
    ['saturday', 'Saturday'],
    ['sunday', 'Sunday'],
  ];

  return orderedDays.map(([key, label]) => {
    const daySchedule = source[key] || {};
    const start = String(daySchedule.start || '').trim();
    const end = String(daySchedule.end || '').trim();
    const isOff = Boolean(daySchedule.off) || start === 'OFF' || end === 'OFF';

    return {
      key,
      label,
      text: isOff ? 'Closed' : `${start || 'Not set'} - ${end || 'Not set'}`,
    };
  });
}

export function extractVenueEmail(venue) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const candidates = [metadata.contactEmail, metadata.email, venue.email].map((item) =>
    typeof item === 'string' ? item.trim() : ''
  );

  return candidates.find(Boolean) || 'Not provided';
}

export function extractVenueImages(venue) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const arrays = [
    metadata.galleryImages,
    metadata.images,
    metadata.imageUrls,
    metadata.photos,
  ];

  const merged = arrays
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  const coverImage = typeof venue.cover_image_url === 'string' ? venue.cover_image_url.trim() : '';
  if (coverImage) {
    merged.unshift(coverImage);
  }

  return [...new Set(merged)];
}

export function resolveVenueRating(venue) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const candidates = [
    venue.average_rating,
    venue.averageRating,
    venue.rating,
    metadata.averageRating,
    metadata.average_rating,
    metadata.rating,
  ];

  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.min(5, numeric);
    }
  }

  return null;
}

export function formatPriceRange(venue) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const minPrice = Number(metadata.minPrice);
  const maxPrice = Number(metadata.maxPrice);

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return 'Not provided';
  }

  return `${minPrice.toLocaleString('en-US')} - ${maxPrice.toLocaleString('en-US')} VND`;
}

export function mapCenterFromWards(wards) {
  for (const ward of wards) {
    const boundary = ward.boundary;
    const features =
      boundary?.type === 'FeatureCollection'
        ? boundary.features
        : boundary?.type === 'Feature'
          ? [boundary]
          : [];

    for (const feature of features) {
      const geometry = feature?.geometry;

      if (geometry?.type === 'Polygon') {
        const firstPoint = geometry.coordinates?.[0]?.[0];
        if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
          return [Number(firstPoint[1]), Number(firstPoint[0])];
        }
      }

      if (geometry?.type === 'MultiPolygon') {
        const firstPoint = geometry.coordinates?.[0]?.[0]?.[0];
        if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
          return [Number(firstPoint[1]), Number(firstPoint[0])];
        }
      }
    }
  }

  return DEFAULT_CITY_CENTER;
}

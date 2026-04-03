const turf = require('@turf/turf');
const wardsRepository = require('../wards/wards.repository');
const { createHttpError } = require('../../shared/http-errors');

function normalizeCoordinate(value, label) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw createHttpError(400, `${label} must be a valid number.`);
  }

  return numericValue;
}

async function detectWardByCoordinates(latitude, longitude) {
  const normalizedLatitude = normalizeCoordinate(latitude, 'latitude');
  const normalizedLongitude = normalizeCoordinate(longitude, 'longitude');
  const point = turf.point([normalizedLongitude, normalizedLatitude]);
  const wards = await wardsRepository.findAllWards();

  for (const ward of wards) {
    const features = ward.boundary?.features || [];

    for (const feature of features) {
      const geometryType = feature.geometry?.type;

      if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
        const isInside = turf.booleanPointInPolygon(point, feature);

        if (isInside) {
          return {
            wardId: ward.ward_id,
            detectedWard: ward.name
          };
        }
      }
    }
  }

  return {
    wardId: null,
    detectedWard: 'Chua xac dinh'
  };
}

module.exports = {
  detectWardByCoordinates
};
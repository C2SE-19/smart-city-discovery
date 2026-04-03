const gisService = require('../gis/gis.service');
const { createHttpError } = require('../../shared/http-errors');
const venuesRepository = require('./venues.repository');

function normalizeVenuePayload(payload) {
  const name = String(payload.name || '').trim();
  const address = String(payload.address || '').trim() || 'Chua co dia chi';
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);

  if (!name) {
    throw createHttpError(400, 'name is required.');
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createHttpError(400, 'latitude and longitude must be valid numbers.');
  }

  return {
    name,
    address,
    latitude,
    longitude
  };
}

async function listVenues() {
  return venuesRepository.findAllVenues();
}

async function createVenue(payload) {
  const normalizedPayload = normalizeVenuePayload(payload);
  const detection = await gisService.detectWardByCoordinates(
    normalizedPayload.latitude,
    normalizedPayload.longitude
  );

  const venue = await venuesRepository.insertVenue({
    ...normalizedPayload,
    wardId: detection.wardId
  });

  return {
    message: 'Venue created successfully',
    detectedWard: detection.detectedWard,
    venue
  };
}

module.exports = {
  listVenues,
  createVenue
};
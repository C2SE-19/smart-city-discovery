const express = require('express');
const asyncHandler = require('../shared/async-handler');
const gisController = require('../modules/gis/gis.controller');
const systemController = require('../modules/system/system.controller');
const venuesController = require('../modules/venues/venues.controller');
const wardsController = require('../modules/wards/wards.controller');

const router = express.Router();

router.get('/test-db', asyncHandler(systemController.getDatabaseTime));
router.get('/wards', asyncHandler(wardsController.listWards));
router.get('/venues', asyncHandler(venuesController.listVenues));
router.post('/venues', asyncHandler(venuesController.createVenue));
router.post('/gis/detect-ward', asyncHandler(gisController.detectWard));

module.exports = router;
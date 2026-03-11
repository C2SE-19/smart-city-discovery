const express = require('express');
const asyncHandler = require('../../shared/async-handler');
const venuesController = require('./venues.controller');

const router = express.Router();

router.get('/', asyncHandler(venuesController.listVenues));
router.post('/', asyncHandler(venuesController.createVenue));

module.exports = router;
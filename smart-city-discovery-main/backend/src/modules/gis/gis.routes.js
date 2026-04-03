const express = require('express');
const asyncHandler = require('../../shared/async-handler');
const gisController = require('./gis.controller');

const router = express.Router();

router.post('/detect-ward', asyncHandler(gisController.detectWard));

module.exports = router;
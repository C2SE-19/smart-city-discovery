const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const gisRoutes = require('../modules/gis/gis.routes');
const recommendationsRoutes = require('../modules/recommendations/recommendations.routes');
const systemRoutes = require('../modules/system/system.routes');
const venuesRoutes = require('../modules/venues/venues.routes');
const wardsRoutes = require('../modules/wards/wards.routes');

const router = express.Router();

router.use('/system', systemRoutes);
router.use('/auth', authRoutes);
router.use('/gis', gisRoutes);
router.use('/wards', wardsRoutes);
router.use('/venues', venuesRoutes);
router.use('/recommendations', recommendationsRoutes);

module.exports = router;

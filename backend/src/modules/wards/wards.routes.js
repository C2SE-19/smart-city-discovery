const express = require('express');
const asyncHandler = require('../../shared/async-handler');
const wardsController = require('./wards.controller');

const router = express.Router();

router.get('/', asyncHandler(wardsController.listWards));

module.exports = router;
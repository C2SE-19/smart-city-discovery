const express = require('express');
const asyncHandler = require('../../shared/async-handler');
const wardsController = require('./wards.controller');

const router = express.Router();

router.get('/', asyncHandler(wardsController.listAdminWards));
router.post('/', asyncHandler(wardsController.upsertWard));
router.delete('/:wardId', asyncHandler(wardsController.deleteWard));

module.exports = router;

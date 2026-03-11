const express = require('express');
const asyncHandler = require('../../shared/async-handler');
const systemController = require('./system.controller');

const router = express.Router();

router.get('/health', systemController.getHealth);
router.get('/database-time', asyncHandler(systemController.getDatabaseTime));
router.get('/modules', systemController.getModuleCatalog);

module.exports = router;
const express = require('express');
const usersController = require('./users.controller');

const router = express.Router();

// Get user profile
router.get('/profile', usersController.getProfile);

// Update user profile
router.put('/profile', usersController.updateProfile);

module.exports = router;

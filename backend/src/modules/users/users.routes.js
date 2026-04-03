const express = require('express');
const usersController = require('./users.controller');

const router = express.Router();

// Admin user management endpoints
router.get('/', usersController.getAllUsers);
router.put('/:id', usersController.updateUserById);
router.delete('/:id', usersController.deleteUser);

// Get user profile
router.get('/profile', usersController.getProfile);

// Update user profile
router.put('/profile', usersController.updateProfile);

module.exports = router;

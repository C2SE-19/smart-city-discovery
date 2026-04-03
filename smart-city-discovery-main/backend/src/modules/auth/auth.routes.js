const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/check-username', authController.checkUsername);
router.post('/check-email', authController.checkEmail);
router.get('/profile', authController.getProfile);

module.exports = router;
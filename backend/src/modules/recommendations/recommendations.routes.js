const express = require('express');
const recommendationsController = require('./recommendations.controller');

const router = express.Router();

router.post('/contextual', recommendationsController.contextualRecommendation);
router.post('/image-recognition', recommendationsController.imageRecognition);
router.post('/chat', recommendationsController.chatRecommendation);

module.exports = router;
const express = require('express');

const router = express.Router();

// Legacy routes can be added here
// For now, just return 404 with helpful message
router.all('*', (req, res) => {
  res.status(404).json({ 
    message: 'Endpoint not found. Please use /api/v1 prefix for API routes' 
  });
});

module.exports = router;

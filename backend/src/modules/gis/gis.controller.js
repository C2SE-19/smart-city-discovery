const gisService = require('./gis.service');

async function detectWard(req, res) {
  const { latitude, longitude } = req.body;
  const detection = await gisService.detectWardByCoordinates(latitude, longitude);
  res.json(detection);
}

module.exports = {
  detectWard
};
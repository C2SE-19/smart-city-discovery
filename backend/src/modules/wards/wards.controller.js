const wardsService = require('./wards.service');

async function listWards(req, res) {
  const wards = await wardsService.listWards();
  res.json(wards);
}

module.exports = {
  listWards
};
const venuesService = require('./venues.service');

async function listVenues(req, res) {
  const venues = await venuesService.listVenues(req.query);
  res.json(venues);
}

async function createVenue(req, res) {
  const createdVenue = await venuesService.createVenue(req.body);
  res.status(201).json(createdVenue);
}

module.exports = {
  listVenues,
  createVenue
};
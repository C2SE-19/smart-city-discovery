const wardsRepository = require('./wards.repository');

async function listWards() {
  return wardsRepository.findAllWards();
}

module.exports = {
  listWards
};
const { query } = require('../../config/database');

async function findAllWards() {
  const result = await query(
    `
      SELECT ward_id, name, boundary
      FROM wards
      ORDER BY name ASC
    `
  );

  return result.rows;
}

module.exports = {
  findAllWards
};
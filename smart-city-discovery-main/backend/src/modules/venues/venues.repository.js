const { query } = require('../../config/database');

async function findAllVenues() {
  const result = await query(
    `
      SELECT venues.*, wards.name AS ward_name
      FROM venues
      LEFT JOIN wards ON wards.ward_id = venues.ward_id
      ORDER BY venues.created_at DESC NULLS LAST, venues.id DESC
    `
  );

  return result.rows;
}

async function insertVenue({ name, address, latitude, longitude, wardId }) {
  const result = await query(
    `
      WITH inserted AS (
        INSERT INTO venues (name, address, latitude, longitude, ward_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      )
      SELECT inserted.*, wards.name AS ward_name
      FROM inserted
      LEFT JOIN wards ON wards.ward_id = inserted.ward_id
    `,
    [name, address, latitude, longitude, wardId]
  );

  return result.rows[0];
}

module.exports = {
  findAllVenues,
  insertVenue
};
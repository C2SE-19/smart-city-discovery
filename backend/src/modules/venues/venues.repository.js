const { query } = require('../../config/database');

const FULL_SELECT_COLUMNS = [
  'venues.id',
  'venues.name',
  'COALESCE(venues.title, venues.name) AS title',
  'venues.description',
  'venues.address',
  'venues.latitude',
  'venues.longitude',
  'venues.ward_id',
  'wards.name AS ward_name',
  'venues.category_id',
  'place_categories.name AS category_name',
  'venues.slug',
  'venues.phone',
  'venues.cover_image_url',
  'venues.business_license_image_url',
  'venues.metadata',
  'venues.status',
  'venues.submitted_at',
  'venues.approved_at',
  'venues.rejected_at',
  'venues.rejection_reason',
  'venues.reviewed_by',
  'venues.submitted_by_user_id',
  'venues.average_rating',
  'venues.total_reviews',
  'venues.is_promoted',
  'venues.created_at',
  'venues.updated_at'
];

const COMPACT_SELECT_COLUMNS = [
  'venues.id',
  'venues.name',
  'COALESCE(venues.title, venues.name) AS title',
  'venues.description',
  'venues.address',
  'venues.latitude',
  'venues.longitude',
  'venues.ward_id',
  'wards.name AS ward_name',
  'venues.category_id',
  'place_categories.name AS category_name',
  'venues.cover_image_url',
  'venues.metadata',
  'venues.status',
  'venues.average_rating',
  'venues.total_reviews',
  'venues.created_at'
];

async function findVenues({ status = null, compact = false, limit = null } = {}) {
  const values = [];
  const whereClauses = [];
  const selectColumns = compact ? COMPACT_SELECT_COLUMNS : FULL_SELECT_COLUMNS;

  if (status) {
    values.push(status);
    whereClauses.push(`venues.status = $${values.length}`);
  }

  let limitClause = '';
  const normalizedLimit = Number(limit);
  if (Number.isInteger(normalizedLimit) && normalizedLimit > 0) {
    values.push(normalizedLimit);
    limitClause = `LIMIT $${values.length}`;
  } else if (compact) {
    values.push(200);
    limitClause = `LIMIT $${values.length}`;
  }

  const result = await query(
    `
      SELECT ${selectColumns.join(', ')}
      FROM venues
      LEFT JOIN wards ON wards.ward_id = venues.ward_id
      LEFT JOIN place_categories ON place_categories.id = venues.category_id
      ${whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ORDER BY venues.created_at DESC NULLS LAST, venues.id DESC
      ${limitClause}
    `
    ,
    values
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
  findVenues,
  insertVenue
};
const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool(env.database);

async function query(text, params = []) {
  return pool.query(text, params);
}

async function verifyConnection() {
  const result = await query('SELECT NOW() AS current_time');
  return result.rows[0];
}

module.exports = {
  pool,
  query,
  verifyConnection
};
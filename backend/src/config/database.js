require('dotenv').config();
console.log("🔥 USING DATABASE CONFIG FROM:", __filename);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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
console.log(env.database);
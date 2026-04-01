process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'root',
  password: 'password123',
  database: 'smartcity_db',

  // 👇 BẮT BUỘC thêm dòng này
  ssl: false,
  sslmode: 'disable'
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
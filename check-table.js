require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

(async () => {
  try {
    const res = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens')"
    );
    console.log('password_reset_tokens table exists:', res.rows[0].exists);
    
    if (res.rows[0].exists) {
      const cols = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'password_reset_tokens'"
      );
      console.log('Columns:', cols.rows.map(c => c.column_name));
    }
    
    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();

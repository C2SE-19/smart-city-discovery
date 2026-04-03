const { Pool } = require('pg');
const pool = new Pool({
  host: '10.50.1.19',
  port: 5433,
  user: 'root',
  password: 'password123',
  database: 'smartcity_db'
});

(async () => {
  try {
    const user = await pool.query("SELECT id FROM users WHERE username='hau123' LIMIT 1");
    console.log('user', user.rows);
    if (user.rows.length === 0) {
      console.error('User not found');
      process.exit(1);
    }
    const id = user.rows[0].id;
    await pool.query("UPDATE users SET status='paused', pause_until = now() + interval '3 days', blocked_reason = NULL WHERE id=$1", [id]);
    console.log('updated', id);
  } catch (err) {
    console.error('error', err);
  } finally {
    await pool.end();
  }
})();
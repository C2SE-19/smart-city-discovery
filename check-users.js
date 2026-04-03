require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function checkUsers() {
  try {
    const result = await pool.query('SELECT id, username, email, role, status FROM users LIMIT 5');
    console.log('Users in database:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Check if admin user exists
    const adminResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    console.log('\nAdmin user details:');
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log('Found admin user:');
      console.log('- ID:', admin.id);
      console.log('- Username:', admin.username);
      console.log('- Email:', admin.email);
      console.log('- Password hash:', admin.password ? admin.password.substring(0, 20) + '...' : 'NULL');
      console.log('- Role:', admin.role);
      console.log('- Status:', admin.status);
    } else {
      console.log('Admin user not found!');
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUsers();

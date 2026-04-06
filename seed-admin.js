require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function seedAdminUser() {
  try {
    // Check if admin exists
    const checkResult = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Admin user already exists');
      const adminId = checkResult.rows[0].id;
      
      // Update password and data
      const passwordHash = await bcryptjs.hash('Admin@123!', 10);
      await pool.query(
        `UPDATE users 
         SET fullname = $1, email = $2, password = $3, role = $4, status = $5, updated_at = NOW()
         WHERE id = $6`,
        ['System Administrator', 'admin@smartcity.local', passwordHash, 'admin', 'active', adminId]
      );
      console.log('✅ Admin user updated with correct password hash');
    } else {
      // Create new admin user
      const passwordHash = await bcryptjs.hash('Admin@123!', 10);
      
      await pool.query(
        `INSERT INTO users (fullname, username, email, password, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['System Administrator', 'admin', 'admin@smartcity.local', passwordHash, 'admin', 'active']
      );
      console.log('✅ Admin user created successfully');
    }
    
    // Verify
    const verifyResult = await pool.query('SELECT id, username, email, role FROM users WHERE username = $1', ['admin']);
    console.log('Admin user:', JSON.stringify(verifyResult.rows[0], null, 2));
    
    console.log('\nLogin credentials:');
    console.log('Username: admin');
    console.log('Password: Admin@123!');
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedAdminUser();

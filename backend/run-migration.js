const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const migrationFiles = [
      '20260313_create_users_table.sql',
      '20260316_admin_map_management_schema.sql',
      '20260317_place_categories_schema.sql',
      '20260316_add_admin_role_and_seed_admin.sql'
    ];

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(__dirname, 'database/migrations', migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      console.log(`Executing migration: ${migrationFile}`);
      await pool.query(sql);
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();

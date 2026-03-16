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
      '20260311_complete_project_schema.sql',
      '20260313_create_users_table.sql',
      '20260316_add_admin_role_and_seed_admin.sql',
      '20260320_create_feedbacks_table.sql'
    ];

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(__dirname, 'database/migrations', migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      console.log(`Executing migration: ${migrationFile}`);
      try {
        await pool.query(sql);
        console.log(`✅ ${migrationFile} completed successfully!`);
      } catch (error) {
        console.warn(`⚠️  ${migrationFile} skipped/failed: ${error.message}`);
      }
    }

    console.log('✅ All migrations executed.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();

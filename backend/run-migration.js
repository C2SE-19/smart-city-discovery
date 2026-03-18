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
      '20260316_admin_map_management_schema.sql',
      '20260317_place_categories_schema.sql',
      '20260316_add_admin_role_and_seed_admin.sql',
      '20260316_add_admin_role_and_seed_admin.sql',
      '20260316_add_user_profile_fields.sql',
      '20260317_cleanup_nan_profile_fields.sql',
      '20260320_create_feedbacks_table.sql',
      '20260321_create_user_favorites.sql',
      '20260322_create_merchant_services.sql',
      '20260318_enable_public_rls_baseline.sql'
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

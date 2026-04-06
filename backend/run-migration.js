require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

function shouldUseDatabaseSsl() {
  const sslValue = String(process.env.DB_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();

  if (['false', '0', 'disable', 'off', 'no'].includes(sslValue)) {
    return false;
  }

  if (['true', '1', 'require', 'on', 'yes'].includes(sslValue)) {
    return true;
  }

  return false;
}

function buildDatabasePoolConfig() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  const config = connectionString
    ? {
        connectionString,
      }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD ?? ''),
        database: process.env.DB_NAME || 'postgres',
      };

  if (shouldUseDatabaseSsl()) {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return config;
}

async function runMigration() {
  const pool = new Pool(buildDatabasePoolConfig());
  const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
      '20260323_feedback_management_extensions.sql',
      '20260321_create_user_favorites.sql',
      '20260322_create_merchant_services.sql',
      '20260318_enable_public_rls_baseline.sql',
      '20260406_add_venues_submitter_user_id.sql'
      '20260403_add_user_status_fields.sql'
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

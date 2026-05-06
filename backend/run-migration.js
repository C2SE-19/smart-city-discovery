require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

  try {
    const migrationFiles = [
      '20260311_complete_project_schema.sql',
      '20260313_create_users_table.sql',
      '20260316_add_admin_role_and_seed_admin.sql',
      '20260316_add_user_profile_fields.sql',
      '20260316_admin_map_management_schema.sql',
      '20260317_cleanup_nan_profile_fields.sql',
      '20260317_place_categories_schema.sql',
      '20260318_enable_public_rls_baseline.sql',
      '20260320_add_user_avatar_url.sql',
      '20260320_create_feedbacks_table.sql',
      '20260321_create_user_favorites.sql',
      '20260322_create_merchant_services.sql',
      '20260323_feedback_management_extensions.sql',
      '20260325_add_icon_to_place_categories.sql',
      '20260403_add_user_status_fields.sql',
      '20260406_add_venues_submitter_user_id.sql',
      '20260408_create_user_ai_preferences.sql',
      '20260410_create_venue_update_requests.sql',
      '20260417_create_forum_posts.sql',
      '20260417_forum_media_comments_likes.sql',
      '20260417_forum_post_reports.sql',
      '20260420_add_parent_comment_to_forum_comments.sql',
      '20260420_add_forum_post_ownership.sql',
      '20260420_add_forum_comment_ownership.sql',
      '20260420_create_forum_comment_reports.sql',
      '20260424_create_forum_banned_keywords.sql',
      '20260424_create_user_notifications.sql',
      '20260424_fix_user_notifications_user_id_type.sql',
      '20260425_add_payos_ad_package_payments.sql',
      '20260505_create_password_reset_tokens.sql'
    ];

    const uniqueMigrationFiles = [...new Set(migrationFiles)];

    for (const migrationFile of uniqueMigrationFiles) {
      const migrationPath = path.join(__dirname, 'database/migrations', migrationFile);
      if (!fs.existsSync(migrationPath)) {
        console.warn(`⚠️  Migration file not found, skipping: ${migrationFile}`);
        continue;
      }

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

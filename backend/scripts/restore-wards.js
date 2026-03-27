require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function parseArgs(argv) {
  const args = {
    file: '',
    mode: 'merge',
    latest: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if ((token === '--file' || token === '-f') && argv[index + 1]) {
      args.file = String(argv[index + 1]);
      index += 1;
      continue;
    }

    if ((token === '--mode' || token === '-m') && argv[index + 1]) {
      args.mode = String(argv[index + 1]).toLowerCase();
      index += 1;
      continue;
    }

    if (token === '--latest' || token === '-l') {
      args.latest = true;
    }
  }

  return args;
}

function resolveLatestBackupPath() {
  const backupDir = path.resolve(__dirname, '..', 'backups', 'wards');

  if (!fs.existsSync(backupDir)) {
    return '';
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((name) => /^wards-backup-\d{8}-\d{6}\.json$/.test(name))
    .map((name) => path.join(backupDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return files[0] || '';
}

function normalizeBackupRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.wards)) {
    return payload.wards;
  }

  return [];
}

function validateWardRow(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }

  const wardId = String(row.ward_id || '').trim();
  const name = String(row.name || '').trim();

  if (!wardId || !name) {
    return false;
  }

  return row.boundary && typeof row.boundary === 'object';
}

async function main() {
  const args = parseArgs(process.argv);

  const resolvedFilePath = args.latest
    ? resolveLatestBackupPath()
    : args.file
      ? path.resolve(process.cwd(), args.file)
      : '';

  if (!resolvedFilePath) {
    console.error('Usage: node scripts/restore-wards.js --file <backup-file> [--mode merge|replace]');
    console.error('   or: node scripts/restore-wards.js --latest [--mode merge|replace]');
    process.exit(1);
  }

  if (!['merge', 'replace'].includes(args.mode)) {
    console.error('Invalid mode. Use: merge or replace');
    process.exit(1);
  }

  const filePath = resolvedFilePath;

  if (!fs.existsSync(filePath)) {
    console.error(`Backup file not found: ${filePath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(filePath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error('Backup file is not valid JSON.');
    process.exit(1);
  }

  const rows = normalizeBackupRows(parsed).filter(validateWardRow);

  if (!rows.length) {
    console.error('No valid ward rows found in backup file.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (args.mode === 'replace') {
      await client.query('DELETE FROM wards');
    }

    const upsertSql = `
      INSERT INTO wards (ward_id, name, description, boundary, is_active, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, now())
      ON CONFLICT (ward_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        boundary = EXCLUDED.boundary,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    `;

    for (const row of rows) {
      await client.query(upsertSql, [
        String(row.ward_id).trim(),
        String(row.name).trim(),
        row.description ? String(row.description) : null,
        row.boundary,
        row.is_active !== false,
      ]);
    }

    await client.query('COMMIT');
    console.log(`Ward restore completed from: ${path.basename(filePath)}`);
    console.log(`Mode: ${args.mode}`);
    console.log(`Total wards restored: ${rows.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ward restore failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

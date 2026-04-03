require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function parseArgs(argv) {
  const args = { output: '' };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if ((token === '--output' || token === '-o') && argv[index + 1]) {
      args.output = String(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

async function main() {
  const args = parseArgs(process.argv);
  const outputDir = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.resolve(__dirname, '..', 'backups', 'wards');

  const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

  try {
    const dbInfo = await pool.query('select current_database() as database_name, current_user as database_user');
    const wardsResult = await pool.query(
      `
        SELECT ward_id, name, description, boundary, is_active, created_at, updated_at
        FROM wards
        ORDER BY name ASC
      `
    );

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: {
        database: dbInfo.rows[0]?.database_name || null,
        user: dbInfo.rows[0]?.database_user || null,
      },
      count: wardsResult.rows.length,
      wards: wardsResult.rows,
    };

    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `wards-backup-${buildTimestamp()}.json`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`Ward backup completed: ${filePath}`);
    console.log(`Total wards exported: ${payload.count}`);
  } catch (error) {
    console.error('Ward backup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

function parseInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? fallbackValue : parsedValue;
}

const databaseUrl = process.env.DATABASE_URL || '';
const useSsl = process.env.DB_SSL === 'true' || databaseUrl.includes('supabase.com');

const database = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInteger(process.env.DB_PORT, 5432),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password123',
      database: process.env.DB_NAME || 'smartcity_db',
      ssl: useSsl ? { rejectUnauthorized: false } : false
    };

module.exports = {
  appName: 'smart-city-discovery-api',
  port: parseInteger(process.env.PORT, 5000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  database
};
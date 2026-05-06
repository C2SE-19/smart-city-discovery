const database = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password123',
  database: process.env.DB_NAME || 'smartcity_db',
  ssl: false
};

const appConfig = {
  port: parseInt(process.env.SERVER_PORT) || 5001,
  appName: 'Smart City Discovery API',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = {
  ...appConfig,
  database
};
const env = require('../../config/env');
const { verifyConnection } = require('../../config/database');

const moduleCatalog = [
  {
    name: 'system',
    status: 'working',
    ownerHint: 'platform member',
    summary: 'Health checks, module registry and environment status.'
  },
  {
    name: 'wards',
    status: 'working',
    ownerHint: 'GIS backend member',
    summary: 'Ward GeoJSON listing and future boundary management.'
  },
  {
    name: 'venues',
    status: 'working',
    ownerHint: 'discovery backend member',
    summary: 'Venue listing and create flow with ward detection.'
  },
  {
    name: 'gis',
    status: 'working',
    ownerHint: 'GIS backend member',
    summary: 'Point-in-polygon ward detection service.'
  },
  {
    name: 'auth',
    status: 'scaffolded',
    ownerHint: 'auth backend member',
    summary: 'JWT auth and role-based permissions.'
  },
  {
    name: 'recommendations',
    status: 'scaffolded',
    ownerHint: 'AI or backend member',
    summary: 'Context recommendation, image recognition and chat contracts.'
  }
];

function getHealth(req, res) {
  res.json({
    service: env.appName,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

async function getDatabaseTime(req, res) {
  const databaseTime = await verifyConnection();

  res.json({
    message: 'Database connection successful',
    time: databaseTime
  });
}

function getModuleCatalog(req, res) {
  res.json({
    service: env.appName,
    modules: moduleCatalog
  });
}

module.exports = {
  getHealth,
  getDatabaseTime,
  getModuleCatalog
};
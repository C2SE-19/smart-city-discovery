module.exports = {
  apps: [
    {
      name: 'smartcity-backend',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        SERVE_FRONTEND_DIST: 'true'
      }
    },
    {
      name: 'smartcity-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'serve -s dist -l 5173',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

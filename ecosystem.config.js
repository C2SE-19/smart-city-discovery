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
    }
  ]
};

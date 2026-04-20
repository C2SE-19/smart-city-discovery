@echo off
cd /d "%~dp0backend"

set DB_HOST=10.50.1.19
set DB_PORT=5433
set DB_USER=root
set DB_PASSWORD=password123
set DB_NAME=smartcity_db

rem Primary port for the backend (default 3000)
set PORT=3000

rem Optional: expose the same app on additional ports (comma-separated)
rem Example: EXTRA_PORTS=5173,5174
set EXTRA_PORTS=5173,5174

echo Running database migrations...
node run-migration.js

echo.
echo Starting backend server...
node server.js

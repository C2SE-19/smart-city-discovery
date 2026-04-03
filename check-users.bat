@echo off
cd /d D:\CAP2code\smart-city-discovery

set DB_HOST=10.50.1.19
set DB_PORT=5433
set DB_USER=root
set DB_PASSWORD=password123
set DB_NAME=smartcity_db

node check-users.js

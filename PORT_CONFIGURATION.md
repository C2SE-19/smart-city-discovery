# Port Configuration Summary

## Fixed Issues
Vấn đề tranh nhau port 3000 đã được giải quyết.

## Current Configuration

### Backend Server
- **Port**: 5000 (defined in SERVER_PORT env var)
- **File**: `backend/server.js` line 24281
- **Env var**: `SERVER_PORT=5000` (in `.env`)
- **Default**: 5000 if not set
- **Host**: 0.0.0.0
- **URL**: http://localhost:5000

### Frontend (Vite Dev Server)
- **Port**: 3000 (configured in vite.config.js)
- **File**: `frontend/vite.config.js`
- **Env var**: `--port 3000` in npm script
- **Host**: 0.0.0.0
- **URL**: http://localhost:3000

### Database Server
- **Port**: 5433 (PostgreSQL)
- **File**: `backend/.env`
- **Env var**: `DB_PORT=5433`

## Environment Variables (backend/.env)
```
SERVER_PORT=5000          # Backend server port
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=*
NODE_ENV=development
DB_PORT=5433
```

## How to Run

### Terminal 1 - Backend
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

Both can run simultaneously without port conflicts.

## Changes Made
1. ✅ Updated `backend/src/config/env.js` to export port and appName
2. ✅ Updated `backend/.env` to include SERVER_PORT=5000
3. ✅ Updated `backend/server.js` to use SERVER_PORT instead of PORT
4. ✅ Updated `frontend/vite.config.js` with server port configuration
5. ✅ Updated `frontend/package.json` npm dev script to use --port 3000

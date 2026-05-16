
Backend (port 3000): cd backend && npm install && npm start
Frontend (5173/5174): cd ../frontend && npm install && npm run build && BACKEND_ORIGIN=http://127.0.0.1:3000 FRONTEND_PORTS=5173,5174 npm run start:lan

git checkout VoVanAnhKhoa2
git pull origin VoVanAnhKhoa2

git add .
git commit -m "update 14/05 real time trend"
git push origin VoVanAnhKhoa2

## Deploy steps (production-ready, ngắn gọn):

<!-- Build frontend -->
cd /home/nextcore/smart-city-discovery/frontend
npm ci
npm run build

Set backend CORS (khuyến nghị strict)
Trong backend .env: CORS_ORIGIN=https://capstone2.nextcore.vn

<!-- Restart PM2 -->
cd /home/nextcore/smart-city-discovery
pm2 start ecosystem.config.js
pm2 save
## chạy bên frontend:
pm2 start "npx serve -s frontend/dist -l 5173" --name frontend
pm2 save

<!-- Apply Nginx -->
sudo nginx -t
sudo systemctl reload nginx

# smart-city-discovery
smart-city-discovery 
# chạy đồ án (dev)

```bash
docker-compose up -d

cd backend
npm run dev

cd ../frontend
npm run dev
```

## Production deployment (LAN)

Mục tiêu production:
- Backend Node.js (Express) chạy port `3000`
- Frontend React được build ra `frontend/dist`
- Backend serve luôn frontend build (không dùng Vite dev server)
- Production public nên dùng cùng origin `/api` qua Nginx hoặc reverse proxy

### 1) Build frontend dist

```bash
cd frontend
npm install
npm run build
npx serve -s dist -l 5173
```

Lệnh `npm run build` mặc định cấu hình frontend gọi API qua:
- `/api`


Nếu cần override API base khi build:

```bash
set VITE_API_URL=/api
npm run build
```

### 2) Chạy backend serve API + dist

```bash
cd ../backend
npm install
npm start
```

Sau khi chạy:
- App UI: domain public hoặc local proxy root `/`
- Swagger: `/api/docs`
- API: `/api/...`

### 3) Chạy 24/7 bằng PM2

```bash
cd D:\Cap2_1504\smart-city-discovery
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```
## chạy bên frontend:
pm2 start "npx serve -s frontend/dist -l 5173" --name frontend
pm2 save

Xem trạng thái/log:

```bash
pm2 status
pm2 logs smartcity-backend
```
## cách dừng pm2 :
pm2 list
pm2 stop all

### 4) Tự chạy lại sau reboot server

```bash
pm2 startup
```

PM2 sẽ in ra 1 lệnh cần chạy thêm (copy/paste đúng lệnh đó), sau đó chạy lại:

```bash
pm2 save
```

### 5) Không phụ thuộc npm run dev

Production chỉ cần:
- Build frontend: `npm run build`
- Chạy backend qua PM2: `pm2 start ecosystem.config.js`

Không cần mở Vite dev server.

### 6) Lưu ý DB local vs DB công ty

App đọc DB theo `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- Dùng local DB: để `DB_HOST=127.0.0.1` hoặc IP local của máy DB
- Dùng DB công ty: để `DB_HOST=<db-host-thuc-te>` (hoặc host DB thực tế)

Không commit file `.env` chứa secrets.

git checkout VoVanAnhKhoa
git pull origin VoVanAnhKhoa

git add .
git commit -m "update something"
git push origin VoVanAnhKhoa

## Backup and Restore Ward Boundaries

Use these commands in `backend` to avoid losing ward boundaries again.

### 1) Create backup snapshot

```bash
cd backend
npm run backup:wards
```

Output file is saved to `backend/backups/wards/wards-backup-YYYYMMDD-HHMMSS.json`.

Optional custom output folder:

```bash
node scripts/backup-wards.js --output ./backups/manual
```

### 2) Restore from backup file

Merge mode (safe default, upsert by `ward_id`, does not clear all current rows):

```bash
cd backend
npm run restore:wards -- --file ./backups/wards/wards-backup-YYYYMMDD-HHMMSS.json --mode merge
```

Replace mode (dangerous, clears `wards` first then imports all from file):

```bash
cd backend
npm run restore:wards -- --file ./backups/wards/wards-backup-YYYYMMDD-HHMMSS.json --mode replace
```

### 3) Recommended routine

- Run `npm run backup:wards` after every major boundary update.
- Keep backup files on cloud drive / external storage.
- Keep at least 7 recent snapshots.

### 4) Enable automatic daily backup on Windows

Create a scheduled task (runs every day at 23:00):

```powershell
schtasks /Create /SC DAILY /TN "SmartCityDiscovery-WardBackup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"D:\cap2_code\smart-city-discovery\backend\scripts\scheduled-ward-backup.ps1\"" /ST 23:00 /F
```

Check task status:

```powershell
schtasks /Query /TN "SmartCityDiscovery-WardBackup" /V /FO LIST
```

Run backup task now (manual trigger):

```powershell
schtasks /Run /TN "SmartCityDiscovery-WardBackup"
```

Delete task (if no longer needed):

```powershell
schtasks /Delete /TN "SmartCityDiscovery-WardBackup" /F
```
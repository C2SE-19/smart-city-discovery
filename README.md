# smart-city-discovery
smart-city-discovery 
# chay đồ án:
D:\smart-city-discovery> docker-compose up -d

cd backend
node server.js

cd frontend
npm run dev

## Chạy LAN (3000 + 5173 + 5174)

Nếu bạn muốn truy cập giống nhau qua nhiều cổng (ví dụ: `http://10.50.1.240:3000/`, `:5173`, `:5174`) và vẫn dùng chung API + frontend build:

1) Build frontend

```bash
npm --prefix frontend run build
```

2) Chạy backend (mở thêm cổng)

CMD (Windows):

```bat
cd backend
npm install
npm run start:lan
```

Swagger UI: `http://10.50.1.240:3000/api/docs`

Gợi ý: kiểm tra nhanh bằng `curl http://10.50.1.240:5173/api/v1/venues`.


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
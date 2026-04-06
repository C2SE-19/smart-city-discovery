$ErrorActionPreference = 'Stop'

$backendRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location $backendRoot

node .\scripts\backup-wards.js

$backupDir = Join-Path $backendRoot 'backups\wards'
if (-not (Test-Path $backupDir)) {
  exit 0
}

# Keep only the newest 30 snapshots to limit disk usage over time.
$backupFiles = Get-ChildItem -Path $backupDir -Filter 'wards-backup-*.json' -File |
  Sort-Object LastWriteTime -Descending

if ($backupFiles.Count -gt 30) {
  $backupFiles |
    Select-Object -Skip 30 |
    ForEach-Object {
      [System.IO.File]::Delete($_.FullName)
    }
}

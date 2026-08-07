# Database Backup & Restore Runbook

## Overview

Daily automated backup of the Gallery PostgreSQL database using `pg_dump`.
Backups are stored in `backups/` as compressed custom-format dumps (`.dump`).
The last 14 backups are kept (~2 weeks of coverage).

---

## Prerequisites

`pg_dump` and `pg_restore` must be on your PATH.

**Check:**
```powershell
pg_dump --version
pg_restore --version
```

If not found, install from the PostgreSQL installer:
- [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
- Or if you installed via another tool, add `C:\Program Files\PostgreSQL\<version>\bin` to your system PATH.

---

## Running a Backup Manually

From the project root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
```

A file named `backups\gallery_YYYY-MM-DD_HH-mm-ss.dump` will be created.

---

## Setting Up the Daily Scheduled Task

Run this once in an **elevated (Administrator) PowerShell** from the project root:

```powershell
$ProjectRoot = (Get-Location).Path
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -File `"$ProjectRoot\scripts\backup-db.ps1`"" `
    -WorkingDirectory $ProjectRoot

$Trigger  = New-ScheduledTaskTrigger -Daily -At "03:00AM"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName "GalleryDBBackup" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Description "Daily Gallery PostgreSQL backup"
```

**Verify it's registered:**
```powershell
Get-ScheduledTask -TaskName "GalleryDBBackup"
```

**Run it immediately to test:**
```powershell
Start-ScheduledTask -TaskName "GalleryDBBackup"
# Wait a moment, then check:
Get-ScheduledTaskInfo -TaskName "GalleryDBBackup"
```

**Remove it if needed:**
```powershell
Unregister-ScheduledTask -TaskName "GalleryDBBackup" -Confirm:$false
```

---

## Restoring from a Backup

### 1. Identify the backup file

```powershell
Get-ChildItem backups\ | Sort-Object LastWriteTime -Descending
```

Pick the file you want, e.g. `backups\gallery_2026-06-18_03-00-00.dump`.

### 2. Drop and recreate the database (if doing a full restore)

> **WARNING: This deletes all current data.** Only do this for disaster recovery.

Connect to your database host and run:
```sql
DROP DATABASE gallery;
CREATE DATABASE gallery;
```

Or if using `psql`:
```powershell
psql $env:DATABASE_URL -c "DROP DATABASE gallery;"
psql $env:DATABASE_URL -c "CREATE DATABASE gallery;"
```

### 3. Restore

```powershell
# Load DATABASE_URL
$line = Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' }
$DB_URL = $line -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''

# Run restore
pg_restore --no-acl --no-owner --clean --if-exists -d $DB_URL backups\gallery_YYYY-MM-DD_HH-mm-ss.dump
```

Replace the filename with the actual backup you want to restore.

### 4. Verify

```powershell
# Quick sanity check — count users and posts
psql $DB_URL -c "SELECT COUNT(*) FROM \"User\"; SELECT COUNT(*) FROM \"Post\";"
```

---

## Backup File Location

`backups/` is in `.gitignore` — dumps are never committed to git (they contain all user data including private images stored as base64).

Make sure the `backups/` folder itself exists or the script will create it automatically.

---

## Offsite Copies (Recommended)

The `backups/` folder is local only. For real disaster recovery, copy dumps offsite:

- **OneDrive/Google Drive**: if the project folder is already in OneDrive, `backups/` is automatically synced
- **Manual copy to external drive**: periodically copy `backups/*.dump` to a USB drive or NAS
- **Cloud storage script**: extend `backup-db.ps1` to upload to S3/R2/Backblaze after dumping

---

## Troubleshooting

| Error | Fix |
|---|---|
| `pg_dump: command not found` | Add PostgreSQL `bin/` to PATH (see Prerequisites) |
| `connection refused` | DATABASE_URL host/port wrong, or DB is down |
| `authentication failed` | Password in DATABASE_URL is wrong |
| `permission denied` on `.env.local` | Run PowerShell as your user, not as SYSTEM |
| Backup file is 0 bytes | pg_dump failed silently — check the error output above it |

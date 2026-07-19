# Gallery Database Backup Script
# Reads DATABASE_URL from .env.local, dumps to backups/, keeps last 14

param(
    [int]$KeepCount = 14
)

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile    = Join-Path $ProjectRoot ".env.local"
$BackupsDir = Join-Path $ProjectRoot "backups"

# --- Read DATABASE_URL ---
if (-not (Test-Path $EnvFile)) {
    Write-Error ".env.local not found at $EnvFile"
    exit 1
}

$DatabaseUrl = $null
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^DATABASE_URL=(.+)$') {
        $DatabaseUrl = $Matches[1].Trim('"').Trim("'")
        break
    }
}

if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL not found in .env.local"
    exit 1
}

# --- Create backups directory ---
New-Item -ItemType Directory -Force -Path $BackupsDir | Out-Null

# --- Run pg_dump ---
$Timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupsDir "gallery_$Timestamp.dump"

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting backup -> $BackupFile"

try {
    pg_dump $DatabaseUrl `
        --format=custom `
        --no-acl `
        --no-owner `
        --file=$BackupFile

    $SizeMB = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Done. Size: ${SizeMB} MB"
} catch {
    Write-Error "pg_dump failed: $_"
    exit 1
}

# --- Rotate old backups ---
$All = Get-ChildItem $BackupsDir -Filter "gallery_*.dump" | Sort-Object LastWriteTime -Descending
if ($All.Count -gt $KeepCount) {
    $ToDelete = $All | Select-Object -Skip $KeepCount
    foreach ($f in $ToDelete) {
        Remove-Item $f.FullName -Force
        Write-Host "Deleted old backup: $($f.Name)"
    }
}

Write-Host "Backups kept: $([Math]::Min($All.Count, $KeepCount)) / $KeepCount"

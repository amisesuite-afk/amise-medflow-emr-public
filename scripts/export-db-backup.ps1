# Amise MedFlow EMR — Windows Database Backup Script
# Run from PowerShell: .\scripts\export-db-backup.ps1
# Or schedule via Task Scheduler for automatic recurring backups.
#
# Creates a timestamped pg_dump of the Supabase Postgres database on this
# machine. Interim mitigation while Supabase PITR (Point-in-Time Recovery)
# is not enabled on the production project — see docs/INCIDENT-RUNBOOK.md's
# "Database point-in-time recovery" section for the cost tradeoff and why
# this was deferred. export-backup.ps1 (source code only) does NOT cover
# patient data — this script is the piece that does.
#
# Requires pg_dump.exe on PATH (install the PostgreSQL client tools) and
# $env:SUPABASE_DB_URL set to the Supabase connection string (Project
# Settings -> Database -> Connection string). Never hardcode credentials
# in this file or commit the resulting .dump file — it contains real
# patient data. Store it encrypted at rest.

param(
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error "pg_dump not found on PATH. Install the PostgreSQL client tools first."
    exit 1
}

if (-not $env:SUPABASE_DB_URL) {
    Write-Error "Set `$env:SUPABASE_DB_URL to the Supabase connection string before running (Project Settings -> Database)."
    exit 1
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ArchiveName = "amise-medflow-db_$Timestamp.dump"

$LocalBackupDir = if ($OutputDir) { $OutputDir } else { "$env:USERPROFILE\Desktop\Amise-DB-Backup" }
New-Item -ItemType Directory -Path $LocalBackupDir -Force | Out-Null
$DestPath = Join-Path $LocalBackupDir $ArchiveName

Write-Host "Dumping Supabase database to: $DestPath"
& pg_dump $env:SUPABASE_DB_URL --format=custom --file="$DestPath"

$Size = [math]::Round((Get-Item $DestPath).Length / 1MB, 1)
Write-Host ""
Write-Host "Database backup complete"
Write-Host "  File: $DestPath"
Write-Host "  Size: ${Size} MB"

# Retention: keep only the 14 most recent local dumps (~2 weeks if run daily)
$Keep = 14
$OldFiles = Get-ChildItem -Path $LocalBackupDir -Filter "amise-medflow-db_*.dump" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $Keep
foreach ($Old in $OldFiles) {
    Remove-Item $Old.FullName
    Write-Host "  Pruned old dump: $($Old.Name)"
}

Write-Host ""
Write-Host "To restore: pg_restore --clean --if-exists -d <target-db-url> `"$DestPath`""
Write-Host "IMPORTANT: This dump contains real patient data — keep it encrypted at rest"
Write-Host "and never sync it to an unencrypted cloud folder."

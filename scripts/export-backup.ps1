# Amise MedFlow EMR — Windows Backup Script
# Run from PowerShell: .\scripts\export-backup.ps1
# Or schedule via Task Scheduler for automatic daily backups.
#
# Creates a timestamped .zip of all source files (no node_modules/dist/.git)
# and copies it to every cloud folder found (OneDrive, Google Drive, Dropbox).

param(
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ArchiveName = "amise-medflow-emr_$Timestamp.zip"

# ── Choose output directory ──────────────────────────────────────────────────

$CloudFolders = @(
    "$env:USERPROFILE\OneDrive\Amise-EMR-Backup",
    "$env:USERPROFILE\OneDrive - Personal\Amise-EMR-Backup",
    "$env:USERPROFILE\Google Drive\Amise-EMR-Backup",
    "$env:USERPROFILE\GoogleDrive\Amise-EMR-Backup",
    "G:\My Drive\Amise-EMR-Backup",       # Google Drive mapped as G:
    "$env:USERPROFILE\Dropbox\Amise-EMR-Backup"
)

# Always write a local copy to Desktop\Amise-EMR-Backup
$LocalBackupDir = "$env:USERPROFILE\Desktop\Amise-EMR-Backup"

if ($OutputDir) {
    $Destinations = @($OutputDir)
} else {
    $Destinations = @($LocalBackupDir)
    foreach ($cf in $CloudFolders) {
        $Parent = Split-Path $cf -Parent
        if (Test-Path $Parent) {
            $Destinations += $cf
        }
    }
}

# ── Build exclusion list ──────────────────────────────────────────────────────

$ExcludeDirs  = @('node_modules', '.git', '.pnpm-store', 'dist', '.next', 'build', '.turbo')
$ExcludeFiles = @('*.log', '.env.local', '.env.*.local')

# ── Gather files ─────────────────────────────────────────────────────────────

Write-Host "Scanning source files in: $RepoRoot"

$AllFiles = Get-ChildItem -Path $RepoRoot -Recurse -File | Where-Object {
    $path = $_.FullName
    $inExcludedDir = $false
    foreach ($d in $ExcludeDirs) {
        if ($path -like "*\$d\*") { $inExcludedDir = $true; break }
    }
    if ($inExcludedDir) { return $false }
    foreach ($pat in $ExcludeFiles) {
        if ($_.Name -like $pat) { return $false }
    }
    return $true
}

Write-Host "Files to archive: $($AllFiles.Count)"

# ── Create temp zip then copy to each destination ────────────────────────────

$TempZip = [System.IO.Path]::Combine($env:TEMP, $ArchiveName)

# Remove old temp if exists
if (Test-Path $TempZip) { Remove-Item $TempZip }

Compress-Archive -Path "$RepoRoot\*" -DestinationPath $TempZip -CompressionLevel Optimal

$ZipInfo = Get-Item $TempZip
$SizeMB  = [math]::Round($ZipInfo.Length / 1MB, 1)

Write-Host ""
Write-Host "Archive size: ${SizeMB} MB"
Write-Host ""

foreach ($Dest in $Destinations) {
    if (-not (Test-Path $Dest)) {
        New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    }
    $DestPath = Join-Path $Dest $ArchiveName
    Copy-Item $TempZip $DestPath
    Write-Host "  Saved -> $DestPath"
}

# ── Cleanup old backups — keep only the 10 most recent in each destination ───

foreach ($Dest in $Destinations) {
    $OldFiles = Get-ChildItem -Path $Dest -Filter "amise-medflow-emr_*.zip" |
                Sort-Object LastWriteTime -Descending |
                Select-Object -Skip 10
    foreach ($Old in $OldFiles) {
        Remove-Item $Old.FullName
        Write-Host "  Removed old backup: $($Old.Name)"
    }
}

Remove-Item $TempZip

Write-Host ""
Write-Host "Backup complete — $ArchiveName  (${SizeMB} MB)"
Write-Host "Destinations:"
foreach ($Dest in $Destinations) {
    Write-Host "  $Dest"
}

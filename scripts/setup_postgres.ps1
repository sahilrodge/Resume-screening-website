# Create recruitment_db on a local PostgreSQL install (Windows).
# Usage: .\scripts\setup_postgres.ps1

$ErrorActionPreference = "Stop"

$env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }
$dbName = "recruitment_db"
$user = "postgres"
$hostName = "localhost"
$port = "5432"

$psqlCandidates = @(
    "psql",
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
)

$psql = $null
foreach ($candidate in $psqlCandidates) {
    if ($candidate -eq "psql") {
        $cmd = Get-Command psql -ErrorAction SilentlyContinue
        if ($cmd) { $psql = $cmd.Source; break }
    } elseif (Test-Path $candidate) {
        $psql = $candidate
        break
    }
}

if (-not $psql) {
    Write-Error "psql not found. Install PostgreSQL or start Docker Compose first."
}

Write-Host "Using: $psql"
Write-Host "Creating database '$dbName' if it does not exist..."

$exists = & $psql -U $user -h $hostName -p $port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
if ($exists -ne "1") {
    & $psql -U $user -h $hostName -p $port -d postgres -c "CREATE DATABASE $dbName;"
    Write-Host "Database created."
} else {
    Write-Host "Database already exists."
}

$extSql = Join-Path $PSScriptRoot "_create_extensions.sql"
@"
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
"@ | Set-Content -Path $extSql -Encoding UTF8

& $psql -U $user -h $hostName -p $port -d $dbName -f $extSql
Remove-Item $extSql -Force

Write-Host "Done. DATABASE_URL=postgresql+psycopg2://${user}:****@${hostName}:${port}/${dbName}"

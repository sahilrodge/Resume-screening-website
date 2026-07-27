# Wrong folder helper — starts the real backend in ../backend
$ErrorActionPreference = "Stop"
$backend = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"

Write-Host "The app lives in: $backend"
Write-Host "Starting uvicorn from backend/.venv ..."
Set-Location $backend
& .\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

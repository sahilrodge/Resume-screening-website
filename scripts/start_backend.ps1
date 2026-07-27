# Start the FastAPI backend (correct project path + venv)
# Usage from project root:
#   .\scripts\start_backend.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

Set-Location $backend

if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

Write-Host "Activating .venv and starting server..."
& .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt -q
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

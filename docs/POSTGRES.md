# PostgreSQL Setup

Database used by the backend: **`recruitment_db`**

Connection string (matches `backend/.env`):

```text
postgresql+psycopg2://postgres:postgres@localhost:5432/recruitment_db
```

## Option A — Docker Compose (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

From the project root:

```powershell
docker compose up -d db
```

Check health:

```powershell
docker compose ps
docker compose logs db
```

Stop:

```powershell
docker compose down
```

Data persists in the `postgres_data` volume.

## Option B — Local PostgreSQL (Windows)

### Install

```powershell
winget install --id PostgreSQL.PostgreSQL.16 -e --accept-package-agreements --accept-source-agreements
```

During install (if prompted), set the `postgres` superuser password to **`postgres`** (or update `backend/.env` to match).

Ensure `psql` is on PATH, or use:

`C:\Program Files\PostgreSQL\16\bin\psql.exe`

### Create the database

From the project root:

```powershell
.\scripts\setup_postgres.ps1
```

Or manually:

```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE recruitment_db;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -d recruitment_db -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -d recruitment_db -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
```

## Verify from Python

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -c "from sqlalchemy import create_engine, text; e=create_engine('postgresql+psycopg2://postgres:postgres@localhost:5432/recruitment_db'); print(e.connect().execute(text('SELECT version()')).scalar())"
```

## Alembic (after models exist)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic revision --autogenerate -m "init"
alembic upgrade head
```

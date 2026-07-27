# Backend Installation Instructions

## Prerequisites

- Python **3.12+**
- PostgreSQL (local or remote)
- Windows PowerShell, macOS/Linux terminal, or WSL

## 1. Go to the backend folder

```powershell
cd "d:\New folder\resume screening website\backend"
```

## 2. Create a virtual environment

```powershell
python -m venv .venv
```

## 3. Activate the virtual environment

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
```

If activation is blocked, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

## 4. Upgrade pip (recommended)

```powershell
python -m pip install --upgrade pip
```

## 5. Install all packages

```powershell
pip install -r requirements.txt
```

## 6. Configure environment variables

```powershell
copy .env.example .env
```

Edit `.env` and set at least:

- `SECRET_KEY` — long random string (32+ characters)
- `DATABASE_URL` — PostgreSQL connection string  
  Example: `postgresql+psycopg2://postgres:postgres@localhost:5432/recruitment_db`

Optional (for later features):

- `OPENAI_API_KEY`
- Twilio / Cloudinary credentials (add when those features are wired up)

## 7. Verify installation

```powershell
python -c "from app.main import app; print(app.title)"
```

Expected output:

```text
AI Recruitment Management System
```

## 8. Run the API server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open:

- API root: http://localhost:8000
- Health: http://localhost:8000/api/v1/health
- Docs: http://localhost:8000/docs

## Packages included

| Package | Purpose |
|---------|---------|
| fastapi | Web API framework |
| uvicorn | ASGI server |
| sqlalchemy | ORM |
| alembic | Database migrations |
| psycopg2-binary | PostgreSQL driver |
| python-dotenv | Load `.env` files |
| passlib / bcrypt | Password hashing |
| python-jose | JWT authentication |
| pydantic / email-validator | Validation |
| pydantic-settings | Settings from env |
| openai | AI features |
| twilio | SMS / messaging |
| httpx | Async HTTP client |
| aiofiles | Async file I/O |
| python-multipart | File uploads |
| cloudinary | Media storage |

## Common issues

**`ModuleNotFoundError`**  
Ensure the virtual environment is activated and you ran `pip install -r requirements.txt` from `backend/`.

**CORS / settings parse errors**  
Use comma-separated origins in `.env`, e.g.  
`CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

**PostgreSQL connection errors**  
Confirm PostgreSQL is running and `DATABASE_URL` matches your user, password, host, and database name.

**PowerShell cannot activate `.venv`**  
Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then activate again.

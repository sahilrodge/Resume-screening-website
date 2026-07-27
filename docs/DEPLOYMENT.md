# HirePulse — Production Deployment Guide

This guide covers Docker, Railway (API + Postgres), Vercel (Next.js), environment variables, CORS, and production logging.

## Architecture

| Layer | Platform | Notes |
|-------|----------|--------|
| Frontend | **Vercel** | Next.js 15 standalone-optimized build |
| Backend API | **Railway** (Docker) | FastAPI + Uvicorn workers |
| Database | **Railway Postgres** | SQLAlchemy + Alembic migrations on boot |
| Optional local stack | **Docker Compose** | `db` + `backend` (+ `frontend` profile) |

```
Browser → Vercel (Next.js)
              ↓ NEXT_PUBLIC_API_URL
         Railway API (/api/v1)
              ↓ DATABASE_URL
         Railway Postgres
```

---

## 1. Prerequisites

- Docker Desktop (for local compose / image builds)
- Railway account + CLI (`npm i -g @railway/cli`)
- Vercel account + CLI (`npm i -g vercel`)
- Strong `SECRET_KEY` (≥ 32 characters)

Generate a secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 2. Environment variables

### Backend (Railway)

Copy from `backend/.env.example`. Required in production:

| Variable | Example | Notes |
|----------|---------|--------|
| `APP_ENV` | `production` | Disables OpenAPI docs; forces JSON logs |
| `DEBUG` | `false` | |
| `SECRET_KEY` | *(random)* | JWT signing |
| `DATABASE_URL` | Railway Postgres URL | `postgres://` is auto-normalized to `postgresql+psycopg2://` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Comma-separated, **no trailing slash** |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Optional preview deploys |
| `LOG_FORMAT` | `json` | Structured logs for Railway |
| `LOG_LEVEL` | `INFO` | |
| `PORT` | *(Railway sets)* | Entrypoint reads `PORT` |
| `WEB_CONCURRENCY` | `2` | Uvicorn workers |
| `RUN_MIGRATIONS` | `true` | `alembic upgrade head` on start |

Integrations (optional but recommended):

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `CLOUDINARY_*`
- `TWILIO_*`, `TWILIO_STATUS_CALLBACK_URL` → `https://<api>/api/v1/whatsapp/webhook/status`
- `VAPI_*`
- `SMTP_*` (email notifications)
- `VAPID_*` (web push)

### Frontend (Vercel)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | `HirePulse` |

These are **build-time** public vars — set them before the first production build and redeploy after changes.

---

## 3. CORS

Configured in `backend/app/main.py` from settings:

1. Set `CORS_ORIGINS` to your exact Vercel production URL (and local if needed).
2. Optionally set `CORS_ORIGIN_REGEX=https://.*\.vercel\.app` for preview deployments.
3. Origins are normalized (trailing slashes stripped) to match browser `Origin` headers.
4. Credentials are enabled (`CORS_ALLOW_CREDENTIALS=true`).

After changing CORS, **restart the Railway service**. Verify with:

```bash
curl -i -X OPTIONS "https://YOUR_API/api/v1/health" \
  -H "Origin: https://YOUR_APP.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```

You should see `access-control-allow-origin` reflecting your frontend origin.

---

## 4. Production logging

- `APP_ENV=production` or `LOG_FORMAT=json` → JSON logs to stdout (Railway log drain friendly).
- Each line includes: `timestamp`, `level`, `logger`, `message`, `service`, `env`, `app`.
- HTTP middleware adds `request_id`, `path`, `method`, `status_code`, `duration_ms`, `client_ip`.
- Health probes are excluded via `LOG_SKIP_PATHS` to reduce noise.
- Uvicorn access log is disabled (`--no-access-log`); app middleware is the source of truth.
- Docs (`/docs`, `/redoc`, `/openapi.json`) are **disabled** in production.

Probes:

- Liveness: `GET /api/v1/health`
- Readiness (DB): `GET /api/v1/health/ready`

---

## 5. Dockerize backend (local)

```bash
# From repo root — Postgres + API
docker compose up -d --build db backend

# Full stack (also builds Next.js standalone)
docker compose --profile full up -d --build

# Production-ish overrides (no public Postgres port)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
```

API: http://localhost:8000/api/v1/health  
Web (full profile): http://localhost:3000

Backend image details:

- `backend/Dockerfile` — Python 3.12 slim, non-root user, healthcheck
- `backend/scripts/entrypoint.sh` — migrations then Uvicorn (`--proxy-headers`)

---

## 6. Railway deployment (API + Postgres)

### One-time setup

1. Create a Railway project.
2. Add a **PostgreSQL** plugin.
3. Create a service from this repo with **Root Directory = `backend`**.
4. Builder uses `Dockerfile` (`backend/railway.toml`).
5. Link Postgres → Railway sets `DATABASE_URL` automatically (normalization handled in config).
6. Set variables from section 2 (especially `SECRET_KEY`, `APP_ENV=production`, `CORS_ORIGINS`).
7. Generate a public domain for the API service.
8. Update Twilio/Vapi webhook URLs to the public Railway hostname.

### CLI (optional)

```bash
cd backend
railway login
railway init
railway add  # or attach existing Postgres
railway variables set APP_ENV=production DEBUG=false LOG_FORMAT=json
railway variables set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
railway variables set CORS_ORIGINS=https://your-app.vercel.app
railway variables set CORS_ORIGIN_REGEX='https://.*\.vercel\.app'
railway up
```

### Post-deploy checks

```bash
curl https://YOUR_API.up.railway.app/api/v1/health
curl https://YOUR_API.up.railway.app/api/v1/health/ready
```

Migrations run automatically when `RUN_MIGRATIONS=true` (default).

---

## 7. Vercel deployment (frontend)

### Dashboard

1. Import the Git repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Next.js (see `frontend/vercel.json`).
4. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://YOUR_API.up.railway.app/api/v1`
   - `NEXT_PUBLIC_APP_NAME=HirePulse`
5. Deploy.

### CLI

```bash
cd frontend
vercel login
vercel link
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_APP_NAME production
vercel --prod
```

### Next.js build optimizations (already configured)

- `output: "standalone"` for Docker
- `compress`, `poweredByHeader: false`
- `optimizePackageImports` for `lucide-react`, `recharts`, `date-fns`, etc.
- Production script uses `next build` (webpack) — more reliable on Vercel than Turbopack build
- Security headers in `vercel.json`

After the frontend URL is known, set Railway `CORS_ORIGINS` to that URL and redeploy the API.

---

## 8. Recommended go-live checklist

- [ ] Strong `SECRET_KEY` set (not the example value)
- [ ] `APP_ENV=production`, `DEBUG=false`
- [ ] `DATABASE_URL` points at Railway Postgres
- [ ] `/api/v1/health` and `/api/v1/health/ready` return OK
- [ ] `CORS_ORIGINS` matches the Vercel domain exactly
- [ ] `NEXT_PUBLIC_API_URL` points at the Railway API `/api/v1`
- [ ] OpenAI / Cloudinary keys set if using parsing & uploads
- [ ] Twilio status callback & Vapi webhook URLs updated
- [ ] Create an admin user (register endpoint or seed script)
- [ ] Confirm login + dashboard load from the Vercel URL

---

## 9. Local development (unchanged)

```bash
# Postgres
docker compose up -d db

# Backend
cd backend
cp .env.example .env   # set APP_ENV=development, LOG_FORMAT=console
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Browser CORS error | Align `CORS_ORIGINS` with the exact frontend origin; restart API |
| `NEXT_PUBLIC_API_URL` still localhost in prod | Rebuild Vercel after setting env (public vars are inlined at build) |
| Railway boot loop | Check logs for DB URL / migrations; hit `/api/v1/health/ready` |
| 502 from Vercel → API | Confirm Railway public domain and HTTPS |
| WhatsApp webhooks fail | Set `TWILIO_STATUS_CALLBACK_URL` to public Railway URL; enable signature validation carefully |

---

## File map

| Path | Purpose |
|------|---------|
| `backend/Dockerfile` | API production image |
| `backend/scripts/entrypoint.sh` | Migrations + Uvicorn |
| `backend/railway.toml` / `railway.json` | Railway Docker deploy |
| `backend/Procfile` / `nixpacks.toml` | Non-Docker fallbacks |
| `frontend/Dockerfile` | Optional Next standalone image |
| `frontend/vercel.json` | Vercel build + security headers |
| `frontend/next.config.ts` | Standalone + package import optimization |
| `docker-compose.yml` | Local/prod-ish multi-service stack |
| `docker-compose.prod.yml` | Stricter compose overrides |
| `backend/.env.example` | Full backend env template |
| `frontend/.env.local.example` | Frontend env template |

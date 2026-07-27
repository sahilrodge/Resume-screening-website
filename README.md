# HirePulse — AI Recruitment Management System

Full-stack recruitment platform: FastAPI + PostgreSQL backend, Next.js admin console.

## Quick start (local)

```bash
# Database
docker compose up -d db

# API
cd backend && cp .env.example .env
# edit SECRET_KEY + DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Web
cd frontend && cp .env.local.example .env.local
npm install && npm run dev
```

- Frontend: http://localhost:3000  
- API health: http://localhost:8000/api/v1/health  
- API docs (dev): http://localhost:8000/docs  

## Production

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for:

- Dockerizing the backend
- Docker Compose
- Railway (API + Postgres)
- Vercel (Next.js)
- Environment variables, CORS, and production logging

## Project layout

```
backend/     FastAPI, Alembic, integrations (OpenAI, Cloudinary)
frontend/    Next.js 15 + Tailwind + Recharts admin UI
docker/      Postgres init scripts
docs/        Deployment & Postgres guides
```

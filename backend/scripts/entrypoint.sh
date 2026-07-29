#!/bin/sh
set -eu

PORT="${PORT:-8000}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

echo "Starting HirePulse API (port=${PORT}, workers=${WEB_CONCURRENCY})"

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
fi

# Optional demo seed — disabled by default (never enable in production)
if [ "${SEED_JOBS_IF_EMPTY:-false}" = "true" ]; then
  if [ "${APP_ENV:-development}" = "production" ]; then
    echo "Skipping job seed in production"
  else
    echo "Seeding Indian jobs if empty..."
    python -m scripts.seed_indian_jobs --if-empty || echo "Job seed skipped"
  fi
fi

# Single worker when concurrency is 1 (simpler debugging / free tiers)
if [ "${WEB_CONCURRENCY}" = "1" ]; then
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --no-access-log
fi

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${WEB_CONCURRENCY}" \
  --proxy-headers \
  --forwarded-allow-ips='*' \
  --no-access-log

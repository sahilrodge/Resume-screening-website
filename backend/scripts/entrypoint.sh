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

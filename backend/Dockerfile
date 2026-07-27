# syntax=docker/dockerfile:1
# Production image for the FastAPI backend
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for psycopg2 and healthchecks
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libpq5 \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Runtime stage keeps the installed packages from base (single stage is fine for size with purge)
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh

RUN chmod +x ./scripts/entrypoint.sh \
    && sed -i 's/\r$//' ./scripts/entrypoint.sh \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENV APP_ENV=production \
    LOG_FORMAT=json \
    LOG_LEVEL=INFO \
    PORT=8000 \
    WEB_CONCURRENCY=2

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

ENTRYPOINT ["./scripts/entrypoint.sh"]

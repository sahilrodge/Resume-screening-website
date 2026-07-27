"""Structured application logging setup."""

from __future__ import annotations

import logging
import sys
from typing import Any

from app.core.config import settings


class ContextFilter(logging.Filter):
    """Inject stable production fields on every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.app = settings.APP_NAME
        record.env = settings.APP_ENV
        record.service = "api"
        return True


class JsonFormatter(logging.Formatter):
    """JSON log formatter for production / Railway log drains."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import UTC, datetime

        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": getattr(record, "service", "api"),
            "env": getattr(record, "env", settings.APP_ENV),
            "app": getattr(record, "app", settings.APP_NAME),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        for key in (
            "request_id",
            "path",
            "method",
            "status_code",
            "duration_ms",
            "client_ip",
        ):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    """Configure root logging based on application settings."""
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(settings.LOG_LEVEL)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())

    use_json = settings.LOG_FORMAT == "json" or settings.is_production
    if use_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-8s | %(env)s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
    root.addHandler(handler)

    # Quiet noisy third-party loggers in production
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DB_ECHO else logging.WARNING
    )
    if settings.is_production:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("openai").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger."""
    return logging.getLogger(name)

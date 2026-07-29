"""Simple in-memory rate limiter for auth endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import Request

from app.core.exceptions import AppException


class RateLimiter:
    """Sliding-window counter keyed by arbitrary strings (IP, email, etc.)."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, *, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = [t for t in self._hits[key] if now - t < window_seconds]
            if len(bucket) >= limit:
                self._hits[key] = bucket
                return False
            bucket.append(now)
            self._hits[key] = bucket
            return True


auth_rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_auth_rate_limit(
    request: Request,
    *,
    action: str,
    identity: str | None = None,
    limit: int = 10,
    window_seconds: int = 60,
) -> None:
    ip = client_ip(request)
    keys = [f"auth:{action}:ip:{ip}"]
    if identity:
        keys.append(f"auth:{action}:id:{identity.strip().lower()}")
    for key in keys:
        if not auth_rate_limiter.is_allowed(
            key, limit=limit, window_seconds=window_seconds
        ):
            raise AppException(
                "Too many attempts. Please wait and try again.",
                status_code=429,
                code="rate_limited",
            )

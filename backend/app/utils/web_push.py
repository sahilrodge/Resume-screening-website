"""Web Push helper (VAPID)."""

from __future__ import annotations

import json
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    title: str,
    body: str,
    url: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Send a Web Push notification. Uses pywebpush when available and VAPID configured."""
    if not settings.vapid_configured:
        logger.info("VAPID not configured — push skipped endpoint=%s", endpoint[:48])
        return {"ok": False, "skipped": True, "error": "VAPID not configured"}

    payload = {
        "title": title,
        "body": body,
        "url": url,
        **(extra or {}),
    }

    try:
        from pywebpush import WebPushException, webpush  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("pywebpush not installed — push skipped")
        return {"ok": False, "skipped": True, "error": "pywebpush not installed"}

    subscription_info = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
        )
        return {"ok": True, "skipped": False}
    except WebPushException as exc:
        logger.warning("Web push failed: %s", exc)
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        return {
            "ok": False,
            "skipped": False,
            "error": str(exc),
            "status_code": status_code,
            "gone": status_code in (404, 410),
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("Web push unexpected error")
        return {"ok": False, "skipped": False, "error": str(exc)}

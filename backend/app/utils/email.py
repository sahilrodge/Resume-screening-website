"""SMTP email helper."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def send_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> dict[str, str | bool]:
    """Send an email via SMTP. Returns status dict; never raises for missing config."""
    if not settings.smtp_configured:
        logger.info(
            "SMTP not configured — email skipped to=%s subject=%s",
            to_email,
            subject,
        )
        return {"ok": False, "skipped": True, "error": "SMTP not configured"}

    msg = EmailMessage()
    from_addr = settings.SMTP_FROM_EMAIL or "noreply@hirepulse.io"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_addr}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST or "", settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return {"ok": True, "skipped": False}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Email send failed to=%s", to_email)
        return {"ok": False, "skipped": False, "error": str(exc)}

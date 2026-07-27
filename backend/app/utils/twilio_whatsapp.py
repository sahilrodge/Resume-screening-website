"""Twilio WhatsApp client helpers."""

from __future__ import annotations

from dataclasses import dataclass

from twilio.request_validator import RequestValidator
from twilio.rest import Client

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class TwilioSendResult:
    sid: str | None
    status: str
    error: str | None = None


def normalize_whatsapp_number(raw: str) -> str:
    """Normalize to Twilio WhatsApp address: whatsapp:+E164."""
    value = (raw or "").strip()
    if not value:
        raise AppException("Phone number is required", status_code=400, code="phone_required")
    if value.startswith("whatsapp:"):
        return value
    digits = "".join(ch for ch in value if ch.isdigit() or ch == "+")
    if not digits.startswith("+"):
        digits = f"+{digits}"
    return f"whatsapp:{digits}"


def strip_whatsapp_prefix(value: str) -> str:
    return value.replace("whatsapp:", "").strip()


def send_whatsapp_message(*, to: str, body: str) -> TwilioSendResult:
    """Send an outbound WhatsApp message via Twilio."""
    if not settings.twilio_configured:
        raise AppException(
            "Twilio WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env",
            status_code=503,
            code="twilio_not_configured",
        )

    to_addr = normalize_whatsapp_number(to)
    from_addr = settings.TWILIO_WHATSAPP_FROM or ""
    if not from_addr.startswith("whatsapp:"):
        from_addr = normalize_whatsapp_number(from_addr)

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    kwargs: dict = {
        "from_": from_addr,
        "to": to_addr,
        "body": body,
    }
    if settings.TWILIO_STATUS_CALLBACK_URL:
        kwargs["status_callback"] = settings.TWILIO_STATUS_CALLBACK_URL

    try:
        message = client.messages.create(**kwargs)
        return TwilioSendResult(sid=message.sid, status=message.status or "queued")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Twilio WhatsApp send failed")
        return TwilioSendResult(sid=None, status="failed", error=str(exc))


def validate_twilio_request(*, url: str, params: dict[str, str], signature: str | None) -> bool:
    """Validate Twilio webhook signature when enabled."""
    if not settings.TWILIO_VALIDATE_SIGNATURE:
        return True
    if not settings.TWILIO_AUTH_TOKEN:
        return False
    if not signature:
        return False
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    return validator.validate(url, params, signature)

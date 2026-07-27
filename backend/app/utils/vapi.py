"""Vapi AI outbound call client."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_QUESTIONS = [
    "Tell me about your relevant experience for this role.",
    "Why are you interested in this position?",
    "What is your notice period or earliest start date?",
]


@dataclass
class VapiCallResult:
    call_id: str | None
    status: str
    raw: dict[str, Any] | None = None
    error: str | None = None


def _normalize_e164(phone: str) -> str:
    value = (phone or "").strip().replace("whatsapp:", "")
    digits = "".join(ch for ch in value if ch.isdigit() or ch == "+")
    if not digits.startswith("+"):
        digits = f"+{digits}"
    return digits


def build_screening_system_prompt(
    *,
    candidate_name: str,
    job_title: str,
    company_name: str | None,
    questions: list[str],
) -> str:
    company = company_name or "our company"
    q_block = "\n".join(f"{idx}. {q}" for idx, q in enumerate(questions, start=1))
    return f"""You are an AI screening interviewer for {company}.
You are calling {candidate_name} about the {job_title} role.

Goals:
- Be warm, professional, and concise.
- Ask the screening questions one at a time and wait for answers.
- Ask brief follow-ups only when an answer is unclear.
- Do not discuss salary negotiation or make hiring promises.
- After all questions, thank the candidate and end the call.

Screening questions:
{q_block}
"""


def create_outbound_call(
    *,
    customer_number: str,
    candidate_name: str,
    job_title: str,
    company_name: str | None,
    questions: list[str],
    metadata: dict[str, Any] | None = None,
) -> VapiCallResult:
    """Place an outbound Vapi phone call for AI screening."""
    if not settings.vapi_configured:
        raise AppException(
            "Vapi is not configured. Set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID in .env",
            status_code=503,
            code="vapi_not_configured",
        )

    qs = [q.strip() for q in questions if q and str(q).strip()] or DEFAULT_QUESTIONS
    phone = _normalize_e164(customer_number)
    first_message = (
        f"Hi {candidate_name}, this is the HirePulse screening assistant calling about "
        f"the {job_title} role"
        + (f" at {company_name}." if company_name else ".")
        + " Do you have a few minutes for a short screening interview?"
    )

    payload: dict[str, Any] = {
        "phoneNumberId": settings.VAPI_PHONE_NUMBER_ID,
        "customer": {"number": phone, "name": candidate_name},
        "metadata": metadata or {},
    }

    system_prompt = build_screening_system_prompt(
        candidate_name=candidate_name,
        job_title=job_title,
        company_name=company_name,
        questions=qs,
    )

    if settings.VAPI_ASSISTANT_ID:
        payload["assistantId"] = settings.VAPI_ASSISTANT_ID
        payload["assistantOverrides"] = {
            "firstMessage": first_message,
            "variableValues": {
                "candidate_name": candidate_name,
                "job_title": job_title,
                "company_name": company_name or "",
                "screening_questions": "\n".join(f"- {q}" for q in qs),
            },
            "model": {
                "provider": "openai",
                "model": settings.OPENAI_MODEL or "gpt-4o-mini",
                "messages": [{"role": "system", "content": system_prompt}],
            },
        }
    else:
        payload["assistant"] = {
            "name": "HirePulse Screener",
            "firstMessage": first_message,
            "model": {
                "provider": "openai",
                "model": settings.OPENAI_MODEL or "gpt-4o-mini",
                "messages": [{"role": "system", "content": system_prompt}],
            },
            "voice": {
                "provider": "openai",
                "voiceId": "alloy",
            },
            "endCallMessage": "Thank you for your time. Our recruiting team will follow up soon. Goodbye.",
            "transcriber": {"provider": "deepgram", "model": "nova-2"},
            "recordingEnabled": True,
        }

    headers = {
        "Authorization": f"Bearer {settings.VAPI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{settings.VAPI_BASE_URL.rstrip('/')}/call/phone",
                headers=headers,
                json=payload,
            )
            if response.status_code >= 400:
                detail = response.text[:500]
                logger.error("Vapi call failed: %s %s", response.status_code, detail)
                return VapiCallResult(
                    call_id=None,
                    status="failed",
                    error=f"Vapi HTTP {response.status_code}: {detail}",
                )
            data = response.json()
            call_id = data.get("id") or data.get("callId")
            status = data.get("status") or "initiated"
            return VapiCallResult(call_id=call_id, status=status, raw=data)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Vapi outbound call exception")
        return VapiCallResult(call_id=None, status="failed", error=str(exc))

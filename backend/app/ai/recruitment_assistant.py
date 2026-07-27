"""OpenAI recruitment assistant (Q&A, job explain, schedule)."""

from __future__ import annotations

import json
from typing import Any

from openai import OpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are HirePulse Recruitment Assistant for candidates and recruiters.
You can:
1) Answer candidate questions about hiring process, roles, and company info from context.
2) Explain a job clearly (responsibilities, requirements, location, compensation if present).
3) Schedule an interview when the user asks and enough details are available.

Return ONLY valid JSON:
{
  "reply": string,
  "action": null | {
    "type": "schedule_interview",
    "application_id": string|null,
    "scheduled_at": string|null (ISO-8601),
    "interview_type": "phone"|"video"|"onsite"|"ai_voice",
    "duration_minutes": number,
    "meeting_link": string|null,
    "location": string|null,
    "send_whatsapp": boolean
  }
}

Rules:
- Be concise, friendly, and accurate. Use only facts from CONTEXT.
- If context is missing, ask a clarifying question.
- For schedule_interview: only set action when the user clearly wants to schedule AND you have (or context has) application_id and scheduled_at.
- If scheduling is requested but details are missing, ask for date/time (and application if needed) in reply and set action=null.
- Never invent job requirements or company policies not in CONTEXT.
"""


class AssistantLLMResult(BaseModel):
    reply: str
    action: dict[str, Any] | None = None


def run_recruitment_assistant(
    *,
    context_block: str,
    history: list[dict[str, str]],
    user_message: str,
) -> AssistantLLMResult:
    if not settings.OPENAI_API_KEY:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in .env",
            status_code=503,
            code="openai_not_configured",
        )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"CONTEXT:\n{context_block}"},
    ]
    for item in history[-20:]:
        role = item.get("role") or "user"
        if role not in {"user", "assistant"}:
            role = "user"
        messages.append({"role": role, "content": item.get("content") or ""})
    messages.append({"role": "user", "content": user_message})

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=messages,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Recruitment assistant OpenAI call failed")
        raise AppException(
            "OpenAI assistant request failed",
            status_code=502,
            code="openai_assistant_failed",
            details=str(exc),
        ) from exc

    content = completion.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AppException(
            "OpenAI returned invalid JSON",
            status_code=502,
            code="openai_invalid_json",
            details=content[:500],
        ) from exc

    reply = str(payload.get("reply") or "").strip()
    if not reply:
        reply = "I can help explain jobs, answer questions, or schedule an interview. How can I assist?"
    action = payload.get("action")
    if action is not None and not isinstance(action, dict):
        action = None
    return AssistantLLMResult(reply=reply, action=action)

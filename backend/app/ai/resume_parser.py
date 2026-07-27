"""OpenAI-powered resume parsing."""

from __future__ import annotations

import json

from openai import OpenAI

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.schemas.parsed_resume import ParsedResumeData

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert resume parser for a recruitment platform.
Extract structured data from the resume text.
Return ONLY valid JSON matching this schema:
{
  "name": string|null,
  "email": string|null,
  "phone": string|null,
  "education": [{"institution": string|null, "degree": string|null, "field": string|null, "start_date": string|null, "end_date": string|null}],
  "experience": [{"company": string|null, "title": string|null, "start_date": string|null, "end_date": string|null, "description": string|null}],
  "skills": [string],
  "projects": [{"name": string|null, "description": string|null, "technologies": [string]}]
}
Rules:
- Prefer accuracy over completeness; use null for unknown fields.
- skills should be a flat list of unique skill names.
- Keep dates as short strings as written on the resume.
- Do not invent employers, schools, or skills not present in the text.
"""


def parse_resume_text(raw_text: str) -> ParsedResumeData:
    """Call OpenAI to extract structured resume fields."""
    if not settings.OPENAI_API_KEY:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in .env",
            status_code=503,
            code="openai_not_configured",
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Parse this resume text:\n\n{raw_text}",
                },
            ],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("OpenAI resume parse failed")
        raise AppException(
            "OpenAI resume parsing failed",
            status_code=502,
            code="openai_parse_failed",
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

    return ParsedResumeData.model_validate(payload)

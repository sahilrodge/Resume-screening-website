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
    if not settings.openai_configured:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in the backend .env file "
            "and restart the API server.",
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


def fallback_parse_resume_text(raw_text: str) -> ParsedResumeData:
    """Best-effort local parse when OpenAI is unavailable or fails."""
    import re

    text = (raw_text or "").strip()
    if not text:
        raise AppException(
            "Resume has no extractable text to parse",
            status_code=400,
            code="resume_no_text",
        )

    email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
    phone_match = re.search(
        r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}",
        text,
    )
    first_line = next(
        (line.strip() for line in text.splitlines() if line.strip()),
        None,
    )
    # Collect capitalized / tech-looking tokens as rough skills
    skill_candidates = re.findall(
        r"\b(?:Python|Java(?:Script)?|TypeScript|React|Node\.?js|SQL|PostgreSQL|"
        r"MySQL|MongoDB|AWS|Azure|Docker|Kubernetes|FastAPI|Django|Flask|Java|"
        r"C\+\+|C#|\.NET|Go|Rust|HTML|CSS|Git|Linux|Excel|Power\s*BI|"
        r"Machine Learning|Deep Learning|NLP|TensorFlow|PyTorch|Pandas|NumPy|"
        r"REST|GraphQL|CI/CD|Agile|Scrum)\b",
        text,
        flags=re.I,
    )
    skills: list[str] = []
    for item in skill_candidates:
        normalized = re.sub(r"\s+", " ", item).strip()
        if normalized and normalized.lower() not in {s.lower() for s in skills}:
            skills.append(normalized)

    return ParsedResumeData(
        name=first_line[:120] if first_line and "@" not in first_line else None,
        email=email_match.group(0) if email_match else None,
        phone=phone_match.group(0).strip() if phone_match else None,
        skills=skills[:40],
    )


def parse_resume_text_with_fallback(raw_text: str) -> tuple[ParsedResumeData, str | None]:
    """
    Parse with OpenAI when configured; otherwise (or on failure) use local fallback.

    Returns (parsed, warning_or_none).
    """
    if settings.openai_configured:
        try:
            return parse_resume_text(raw_text), None
        except AppException as exc:
            logger.warning("Falling back to local resume parse: %s", exc.message)
            return fallback_parse_resume_text(raw_text), exc.message
    return fallback_parse_resume_text(raw_text), "openai_not_configured"

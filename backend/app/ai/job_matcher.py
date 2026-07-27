"""OpenAI-powered resume vs job description matching."""

from __future__ import annotations

import json

from openai import OpenAI

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.schemas.match_result import MatchResult

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert technical recruiter evaluating resume fit for a job.
Compare the candidate resume against the job description.
Return ONLY valid JSON matching this schema:
{
  "match_score": number (0-100),
  "matching_skills": [string],
  "missing_skills": [string],
  "summary": string,
  "reasoning": string
}
Rules:
- match_score reflects overall fit (skills, experience, seniority, domain).
- matching_skills: skills clearly evidenced on the resume that the job needs.
- missing_skills: important job requirements not evidenced on the resume.
- summary: 2-4 sentences for a recruiter overview.
- reasoning: clear explanation of why the score was given (strengths + gaps).
- Do not invent resume skills that are not supported by the resume content.
- Prefer concrete skill names (e.g. "Python", "PostgreSQL") over vague phrases.
"""


def compare_resume_to_job(
    *,
    job_title: str,
    job_description: str,
    resume_payload: str,
) -> MatchResult:
    """Call OpenAI to score resume fit against a job description."""
    if not settings.OPENAI_API_KEY:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in .env",
            status_code=503,
            code="openai_not_configured",
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    user_content = (
        f"JOB TITLE:\n{job_title}\n\n"
        f"JOB DESCRIPTION:\n{job_description[:12000]}\n\n"
        f"RESUME DATA:\n{resume_payload[:12000]}"
    )

    try:
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("OpenAI job match failed")
        raise AppException(
            "OpenAI resume matching failed",
            status_code=502,
            code="openai_match_failed",
            details=str(exc),
        ) from exc

    content = completion.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AppException(
            "OpenAI returned invalid JSON for match result",
            status_code=502,
            code="openai_invalid_json",
            details=content[:500],
        ) from exc

    return MatchResult.model_validate(payload)

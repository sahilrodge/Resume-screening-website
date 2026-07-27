"""OpenAI-powered resume vs job description matching + ATS screening."""

from __future__ import annotations

import json
import re

from openai import OpenAI

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger
from app.schemas.match_result import MatchResult

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert technical recruiter and ATS specialist.
Evaluate the candidate resume against the job description.
Return ONLY valid JSON matching this schema:
{
  "match_score": number (0-100),
  "ats_score": number (0-100),
  "matching_skills": [string],
  "missing_skills": [string],
  "strengths": [string],
  "weaknesses": [string],
  "suggestions": [string],
  "summary": string,
  "reasoning": string
}
Rules:
- match_score: overall role fit (skills, experience, seniority, domain).
- ats_score: how well the resume would pass an Applicant Tracking System
  (keyword coverage for the job, clear section structure cues, measurable
  impact, role-relevant titles, absence of vague filler). Independent from
  match_score — a strong candidate with a poorly structured resume can have
  high match_score and lower ats_score.
- matching_skills: skills clearly evidenced on the resume that the job needs.
- missing_skills: important job requirements not evidenced on the resume.
- strengths: 3-6 concrete strengths for this role (short bullet phrases).
- weaknesses: 3-6 concrete gaps/risks for this role (short bullet phrases).
- suggestions: 3-6 actionable resume improvements to raise ATS and match scores.
- summary: 2-4 sentences for a recruiter overview.
- reasoning: clear explanation of both scores (fit + ATS).
- Do not invent resume skills that are not supported by the resume content.
- Prefer concrete skill names (e.g. "Python", "PostgreSQL") over vague phrases.
"""


def _heuristic_ats_score(resume_payload: str, job_description: str) -> float:
    """Fallback ATS estimate when the model omits ats_score."""
    text = resume_payload.lower()
    job = job_description.lower()
    score = 40.0

    section_hits = sum(
        1
        for key in (
            "experience",
            "education",
            "skill",
            "project",
            "summary",
            "work history",
        )
        if key in text
    )
    score += min(20.0, section_hits * 4)

    tokens = {t for t in re.findall(r"[a-zA-Z][a-zA-Z0-9+.#-]{2,}", job) if len(t) > 3}
    if tokens:
        hits = sum(1 for t in tokens if t in text)
        coverage = hits / max(1, len(tokens))
        score += coverage * 35

    if re.search(r"\d+\+?\s*(years?|yrs?)", text):
        score += 5
    return max(0.0, min(100.0, round(score, 2)))


def compare_resume_to_job(
    *,
    job_title: str,
    job_description: str,
    resume_payload: str,
) -> MatchResult:
    """Call OpenAI to score resume fit and ATS quality against a job."""
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

    if payload.get("ats_score") in (None, ""):
        payload["ats_score"] = _heuristic_ats_score(resume_payload, job_description)

    return MatchResult.model_validate(payload)

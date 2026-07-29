"""OpenAI-powered resume vs job description matching + ATS screening."""

from __future__ import annotations

import json

from openai import OpenAI

from app.ai.local_screener import local_screen_resume
from app.core.config import settings
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
  "reasoning": string,
  "confidence": number (0-100)
}
Rules:
- match_score: overall role fit (skills, experience, seniority, domain).
- ats_score: how well the resume would pass an Applicant Tracking System
  (keyword coverage, section structure, measurable impact, role-relevant titles).
  Independent from match_score.
- matching_skills: skills clearly evidenced on the resume that the job needs.
- missing_skills: important job requirements not evidenced on the resume.
- strengths: 3-6 concrete strengths for this role.
- weaknesses: 3-6 concrete gaps/risks for this role.
- suggestions: 3-6 actionable resume improvements.
- summary: 2-4 sentences for a recruiter overview.
- reasoning: clear explanation of both scores.
- confidence: how confident you are in this evaluation given resume completeness.
- Do not invent resume skills that are not supported by the resume content.
- Prefer concrete skill names (e.g. "Python", "PostgreSQL") over vague phrases.
"""


def compare_resume_to_job(
    *,
    job_title: str,
    job_description: str,
    resume_payload: str,
) -> MatchResult:
    """Score resume fit and ATS quality (OpenAI preferred, local multi-factor fallback)."""
    if settings.openai_configured:
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
            content = completion.choices[0].message.content or "{}"
            payload = json.loads(content)
            payload["scoring_engine"] = "openai"
            if payload.get("confidence") in (None, ""):
                payload["confidence"] = 88.0
            if payload.get("ats_score") in (None, ""):
                # Fill ATS from local factors only for the missing field
                local = local_screen_resume(
                    job_title=job_title,
                    job_description=job_description,
                    resume_payload=resume_payload,
                )
                payload["ats_score"] = local.ats_score
            result = MatchResult.model_validate(payload)
            result.scoring_engine = "openai"
            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("OpenAI job match failed; using local multi-factor screen: %s", exc)

    return local_screen_resume(
        job_title=job_title,
        job_description=job_description,
        resume_payload=resume_payload,
    )

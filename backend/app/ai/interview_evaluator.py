"""OpenAI evaluation of AI screening call transcripts."""

from __future__ import annotations

import json

from openai import OpenAI
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert recruiter evaluating a phone screening transcript.
Score the candidate for the given role using the screening questions and answers.
Return ONLY valid JSON:
{
  "interview_score": number (0-100),
  "summary": string,
  "strengths": [string],
  "gaps": [string],
  "recommendation": "advance" | "hold" | "reject",
  "reasoning": string
}
Rules:
- Base the score only on evidence in the transcript.
- Be fair and specific.
- If the transcript is empty or unusable, give a low score and explain why.
"""


class InterviewEvaluation(BaseModel):
    interview_score: float = Field(ge=0, le=100)
    summary: str
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    recommendation: str = "hold"
    reasoning: str

    @field_validator("interview_score", mode="before")
    @classmethod
    def clamp_score(cls, value: object) -> float:
        score = float(value)  # type: ignore[arg-type]
        return max(0.0, min(100.0, round(score, 2)))

    @field_validator("recommendation", mode="before")
    @classmethod
    def normalize_recommendation(cls, value: object) -> str:
        text = str(value or "hold").strip().lower()
        if text not in {"advance", "hold", "reject"}:
            return "hold"
        return text


def evaluate_screening_transcript(
    *,
    transcript: str,
    job_title: str,
    questions: list[str],
) -> InterviewEvaluation:
    if not settings.OPENAI_API_KEY:
        raise AppException(
            "OpenAI is not configured. Set OPENAI_API_KEY in .env",
            status_code=503,
            code="openai_not_configured",
        )

    q_text = "\n".join(f"- {q}" for q in questions) or "- (none provided)"
    user_content = (
        f"ROLE: {job_title}\n\n"
        f"SCREENING QUESTIONS:\n{q_text}\n\n"
        f"TRANSCRIPT:\n{transcript[:15000]}"
    )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
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
        logger.exception("OpenAI interview evaluation failed")
        raise AppException(
            "OpenAI interview evaluation failed",
            status_code=502,
            code="openai_eval_failed",
            details=str(exc),
        ) from exc

    content = completion.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AppException(
            "OpenAI returned invalid JSON for interview evaluation",
            status_code=502,
            code="openai_invalid_json",
            details=content[:500],
        ) from exc

    return InterviewEvaluation.model_validate(payload)

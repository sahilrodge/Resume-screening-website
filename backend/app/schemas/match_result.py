"""Schemas for resume ↔ job match / ATS screening results."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


def _coerce_str_list(value: object) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _clamp_score(value: object) -> float:
    score = float(value)  # type: ignore[arg-type]
    return max(0.0, min(100.0, round(score, 2)))


class MatchResult(BaseModel):
    match_score: float = Field(ge=0, le=100)
    ats_score: float = Field(default=0, ge=0, le=100)
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    summary: str
    reasoning: str

    @field_validator(
        "matching_skills",
        "missing_skills",
        "strengths",
        "weaknesses",
        "suggestions",
        mode="before",
    )
    @classmethod
    def coerce_lists(cls, value: object) -> list[str]:
        return _coerce_str_list(value)

    @field_validator("match_score", "ats_score", mode="before")
    @classmethod
    def clamp_scores(cls, value: object) -> float:
        if value is None or value == "":
            return 0.0
        return _clamp_score(value)

"""Schemas for resume ↔ job match results."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class MatchResult(BaseModel):
    match_score: float = Field(ge=0, le=100)
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    summary: str
    reasoning: str

    @field_validator("matching_skills", "missing_skills", mode="before")
    @classmethod
    def coerce_skill_lists(cls, value: object) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    @field_validator("match_score", mode="before")
    @classmethod
    def clamp_score(cls, value: object) -> float:
        score = float(value)  # type: ignore[arg-type]
        return max(0.0, min(100.0, round(score, 2)))

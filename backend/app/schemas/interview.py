"""Interview schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import InterviewStatus, InterviewType


class InterviewCreate(BaseModel):
    application_id: uuid.UUID
    scheduled_at: datetime
    interview_type: InterviewType = InterviewType.VIDEO
    duration_minutes: int = Field(default=60, ge=15, le=480)
    meeting_link: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=255)


class InterviewStatusUpdate(BaseModel):
    status: InterviewStatus

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> object:
        if isinstance(value, str):
            key = value.strip().lower().replace(" ", "_")
            aliases = {
                "no-show": InterviewStatus.NO_SHOW.value,
                "noshow": InterviewStatus.NO_SHOW.value,
            }
            return aliases.get(key, key)
        return value


class InterviewTimelineStep(BaseModel):
    key: str
    label: str
    completed: bool
    current: bool = False
    at: datetime | None = None


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    candidate_name: str | None = None
    job_title: str | None = None
    company_name: str | None = None
    interviewer_id: uuid.UUID | None = None
    interview_type: InterviewType
    status: InterviewStatus
    scheduled_at: datetime
    duration_minutes: int
    meeting_link: str | None = None
    location: str | None = None
    status_changed_at: datetime | None = None
    status_history: list[dict[str, Any]] = Field(default_factory=list)
    timeline: list[InterviewTimelineStep] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class InterviewListResponse(BaseModel):
    items: list[InterviewResponse]
    total: int

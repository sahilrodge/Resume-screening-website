"""Interview schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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
    created_at: datetime
    updated_at: datetime


class InterviewListResponse(BaseModel):
    items: list[InterviewResponse]
    total: int

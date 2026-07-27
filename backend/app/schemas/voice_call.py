"""Voice call / Vapi screening schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import VoiceCallStatus


class VoiceCallResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    candidate_id: uuid.UUID | None = None
    candidate_name: str | None = None
    application_id: uuid.UUID | None = None
    job_title: str | None = None
    to_number: str
    from_number: str
    status: VoiceCallStatus
    provider_call_id: str | None = None
    duration_seconds: int | None = None
    recording_url: str | None = None
    transcript: str | None = None
    interview_score: float | None = None
    evaluation_summary: str | None = None
    recommendation: str | None = None
    screening_questions: list[str] = Field(default_factory=list)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    error_message: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class VoiceCallListResponse(BaseModel):
    items: list[VoiceCallResponse]
    total: int
    page: int
    page_size: int
    pages: int


class VoiceCallTriggerRequest(BaseModel):
    application_id: uuid.UUID

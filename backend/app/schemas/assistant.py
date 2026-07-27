"""Recruitment assistant API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ChatRole


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    candidate_id: uuid.UUID | None = None
    job_id: uuid.UUID | None = None
    application_id: uuid.UUID | None = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class AssistantMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: ChatRole
    content: str
    meta: dict[str, Any] | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_by_user_id: uuid.UUID
    candidate_id: uuid.UUID | None = None
    candidate_name: str | None = None
    job_id: uuid.UUID | None = None
    job_title: str | None = None
    application_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[AssistantMessageResponse] = Field(default_factory=list)


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int


class ChatReplyResponse(BaseModel):
    conversation: ConversationResponse
    reply: AssistantMessageResponse
    action_result: dict[str, Any] | None = None


class ScheduleInterviewAction(BaseModel):
    type: Literal["schedule_interview"] = "schedule_interview"
    application_id: uuid.UUID | None = None
    scheduled_at: datetime | None = None
    interview_type: str = "video"
    duration_minutes: int = 60
    meeting_link: str | None = None
    location: str | None = None
    send_whatsapp: bool = True

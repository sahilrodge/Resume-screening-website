"""WhatsApp log schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import WhatsappDirection, WhatsappStatus
from app.services.whatsapp_templates import WhatsappEvent


class WhatsappLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    candidate_id: uuid.UUID | None = None
    candidate_name: str | None = None
    to_number: str
    from_number: str
    direction: WhatsappDirection
    status: WhatsappStatus
    message_body: str | None = None
    provider_message_id: str | None = None
    error_message: str | None = None
    event_type: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class WhatsappLogListResponse(BaseModel):
    items: list[WhatsappLogResponse]
    total: int
    page: int
    page_size: int
    pages: int


class WhatsappSendRequest(BaseModel):
    candidate_id: uuid.UUID
    event: WhatsappEvent = WhatsappEvent.MANUAL
    body: str | None = Field(default=None, max_length=1600)
    application_id: uuid.UUID | None = None
    interview_id: uuid.UUID | None = None


class WhatsappStatusUpdateRequest(BaseModel):
    """Manual recruiter action that may trigger WhatsApp."""

    status: str
    send_whatsapp: bool = True


class ReminderSendResponse(BaseModel):
    sent: int
    skipped: int
    failures: int
    items: list[WhatsappLogResponse] = Field(default_factory=list)

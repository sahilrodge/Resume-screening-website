"""Notification API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import (
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
)


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    notification_type: NotificationType
    channel: NotificationChannel
    delivery_status: NotificationDeliveryStatus
    is_read: bool
    read_at: datetime | None = None
    link: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    pages: int
    unread_count: int = 0
    channel_counts: dict[str, int] = Field(default_factory=dict)


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadRequest(BaseModel):
    is_read: bool = True


class NotificationPreferenceResponse(BaseModel):
    email_enabled: bool
    in_app_enabled: bool
    push_enabled: bool
    vapid_public_key: str | None = None
    smtp_configured: bool = False
    push_configured: bool = False

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: bool | None = None
    in_app_enabled: bool | None = None
    push_enabled: bool | None = None


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10)
    p256dh: str = Field(..., min_length=10)
    auth: str = Field(..., min_length=8)
    user_agent: str | None = Field(default=None, max_length=500)


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10)


class PushSubscriptionResponse(BaseModel):
    id: uuid.UUID
    endpoint: str
    created_at: datetime

    model_config = {"from_attributes": True}


class NotifyTestRequest(BaseModel):
    title: str = Field(default="Test notification", max_length=255)
    message: str = Field(default="This is a test from HirePulse.", max_length=2000)
    channels: list[NotificationChannel] | None = None

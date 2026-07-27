"""In-app / multi-channel notification model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import (
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
)
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(
            NotificationType,
            name="notification_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=NotificationType.INFO,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        SAEnum(
            NotificationChannel,
            name="notification_channel",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=NotificationChannel.IN_APP,
        index=True,
    )
    delivery_status: Mapped[NotificationDeliveryStatus] = mapped_column(
        SAEnum(
            NotificationDeliveryStatus,
            name="notification_delivery_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=NotificationDeliveryStatus.SENT,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped[User] = relationship("User", back_populates="notifications")

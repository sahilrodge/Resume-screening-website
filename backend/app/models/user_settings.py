"""Per-user app settings (language + privacy)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserSettings(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    profile_discoverable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    show_email_to_recruiters: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    allow_ai_processing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    share_activity_status: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    user: Mapped[User] = relationship("User", back_populates="settings")

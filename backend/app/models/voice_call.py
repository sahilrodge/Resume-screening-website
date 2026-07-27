"""Voice call log model (Twilio / AI interviews)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import VoiceCallStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.candidate import Candidate
    from app.models.user import User


class VoiceCall(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "voice_calls"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    to_number: Mapped[str] = mapped_column(String(30), nullable=False)
    from_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[VoiceCallStatus] = mapped_column(
        SAEnum(
            VoiceCallStatus,
            name="voice_call_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=VoiceCallStatus.INITIATED,
        index=True,
    )
    provider_call_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped[User | None] = relationship("User", back_populates="voice_calls")
    candidate: Mapped[Candidate | None] = relationship("Candidate", back_populates="voice_calls")
    application: Mapped[Application | None] = relationship(
        "Application",
        back_populates="voice_calls",
    )

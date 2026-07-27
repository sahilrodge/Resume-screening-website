"""Interview model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import InterviewStatus, InterviewType
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class Interview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "interviews"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    interview_type: Mapped[InterviewType] = mapped_column(
        SAEnum(
            InterviewType,
            name="interview_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=InterviewType.VIDEO,
    )
    status: Mapped[InterviewStatus] = mapped_column(
        SAEnum(
            InterviewStatus,
            name="interview_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=InterviewStatus.SCHEDULED,
        index=True,
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    meeting_link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    application: Mapped[Application] = relationship("Application", back_populates="interviews")
    interviewer: Mapped[User | None] = relationship("User", back_populates="interviews_conducted")

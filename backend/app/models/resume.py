"""Resume model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import ResumeStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.candidate import Candidate


class Resume(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "resumes"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    file_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[ResumeStatus] = mapped_column(
        SAEnum(
            ResumeStatus,
            name="resume_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ResumeStatus.UPLOADED,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidate: Mapped[Candidate] = relationship("Candidate", back_populates="resumes")
    applications: Mapped[list[Application]] = relationship(
        "Application",
        back_populates="resume",
    )

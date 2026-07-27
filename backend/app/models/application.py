"""Job application model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import ApplicationStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.interview import Interview
    from app.models.job import Job
    from app.models.resume import Resume


class Application(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_job_candidate_application"),
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(
            ApplicationStatus,
            name="application_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ApplicationStatus.APPLIED,
        index=True,
    )
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    match_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    ats_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    matching_skills: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    missing_skills: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    strengths: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    weaknesses: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    suggestions: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped[Job] = relationship("Job", back_populates="applications")
    candidate: Mapped[Candidate] = relationship("Candidate", back_populates="applications")
    resume: Mapped[Resume | None] = relationship("Resume", back_populates="applications")
    interviews: Mapped[list[Interview]] = relationship(
        "Interview",
        back_populates="application",
        cascade="all, delete-orphan",
    )

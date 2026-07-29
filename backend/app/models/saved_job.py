"""Saved / bookmarked jobs for candidates."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.job import Job


class SavedJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "saved_jobs"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_saved_job"),
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    candidate: Mapped[Candidate] = relationship("Candidate", back_populates="saved_jobs")
    job: Mapped[Job] = relationship("Job", back_populates="saved_by")

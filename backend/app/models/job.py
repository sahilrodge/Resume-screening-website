"""Job posting model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import EmploymentType, JobStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.company import Company
    from app.models.recruiter import Recruiter
    from app.models.saved_job import SavedJob
    from app.models.skill import JobSkill


class Job(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "jobs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recruiters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[EmploymentType] = mapped_column(
        SAEnum(
            EmploymentType,
            name="employment_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=EmploymentType.FULL_TIME,
    )
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, name="job_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=JobStatus.DRAFT,
        index=True,
    )
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    experience_min_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_max_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    openings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    company: Mapped[Company] = relationship("Company", back_populates="jobs")
    recruiter: Mapped[Recruiter | None] = relationship("Recruiter", back_populates="jobs")
    applications: Mapped[list[Application]] = relationship(
        "Application",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list[JobSkill]] = relationship(
        "JobSkill",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    saved_by: Mapped[list[SavedJob]] = relationship(
        "SavedJob",
        back_populates="job",
        cascade="all, delete-orphan",
    )

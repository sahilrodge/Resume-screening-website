"""Skill master table and association models."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import SkillLevel
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.job import Job


class Skill(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    candidates: Mapped[list[CandidateSkill]] = relationship(
        "CandidateSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )
    jobs: Mapped[list[JobSkill]] = relationship(
        "JobSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class CandidateSkill(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Many-to-many: Candidate <-> Skill."""

    __tablename__ = "candidate_skills"
    __table_args__ = (
        UniqueConstraint("candidate_id", "skill_id", name="uq_candidate_skill"),
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    level: Mapped[SkillLevel] = mapped_column(
        SAEnum(SkillLevel, name="skill_level", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SkillLevel.INTERMEDIATE,
    )
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)

    candidate: Mapped[Candidate] = relationship("Candidate", back_populates="skills")
    skill: Mapped[Skill] = relationship("Skill", back_populates="candidates")


class JobSkill(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Many-to-many: Job <-> Skill."""

    __tablename__ = "job_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),)

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    level: Mapped[SkillLevel] = mapped_column(
        SAEnum(SkillLevel, name="skill_level", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SkillLevel.INTERMEDIATE,
    )

    job: Mapped[Job] = relationship("Job", back_populates="skills")
    skill: Mapped[Skill] = relationship("Skill", back_populates="jobs")

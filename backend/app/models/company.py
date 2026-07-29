"""Company SQLAlchemy model."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.recruiter import Recruiter


class Company(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    employee_count: Mapped[str | None] = mapped_column(String(60), nullable=True)
    culture: Mapped[str | None] = mapped_column(Text, nullable=True)
    benefits: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    social_links: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    recruiters: Mapped[list[Recruiter]] = relationship(
        "Recruiter",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    jobs: Mapped[list[Job]] = relationship(
        "Job",
        back_populates="company",
        cascade="all, delete-orphan",
    )

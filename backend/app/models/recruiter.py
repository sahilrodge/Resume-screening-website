"""Recruiter profile model (1:1 with User, belongs to Company)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.job import Job
    from app.models.user import User


class Recruiter(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "recruiters"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="recruiter_profile")
    company: Mapped[Company | None] = relationship("Company", back_populates="recruiters")
    jobs: Mapped[list[Job]] = relationship("Job", back_populates="recruiter")

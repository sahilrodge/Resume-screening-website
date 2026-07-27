"""Candidate profile model (1:1 with User)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.resume import Resume
    from app.models.skill import CandidateSkill
    from app.models.user import User
    from app.models.voice_call import VoiceCall
    from app.models.whatsapp_log import WhatsappLog


class Candidate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "candidates"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    current_title: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="candidate_profile")
    resumes: Mapped[list[Resume]] = relationship(
        "Resume",
        back_populates="candidate",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list[Application]] = relationship(
        "Application",
        back_populates="candidate",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list[CandidateSkill]] = relationship(
        "CandidateSkill",
        back_populates="candidate",
        cascade="all, delete-orphan",
    )
    whatsapp_logs: Mapped[list[WhatsappLog]] = relationship(
        "WhatsappLog",
        back_populates="candidate",
    )
    voice_calls: Mapped[list[VoiceCall]] = relationship(
        "VoiceCall",
        back_populates="candidate",
    )

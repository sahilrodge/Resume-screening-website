"""User SQLAlchemy model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.interview import Interview
    from app.models.notification import Notification
    from app.models.notification_preference import NotificationPreference
    from app.models.push_subscription import PushSubscription
    from app.models.recruiter import Recruiter
    from app.models.refresh_token import RefreshToken
    from app.models.user_settings import UserSettings


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Application user with role-based access."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.CANDIDATE,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    candidate_profile: Mapped[Candidate | None] = relationship(
        "Candidate",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    recruiter_profile: Mapped[Recruiter | None] = relationship(
        "Recruiter",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list[Notification]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    notification_preference: Mapped[NotificationPreference | None] = relationship(
        "NotificationPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    push_subscriptions: Mapped[list[PushSubscription]] = relationship(
        "PushSubscription",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    settings: Mapped[UserSettings | None] = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    interviews_conducted: Mapped[list[Interview]] = relationship(
        "Interview",
        back_populates="interviewer",
    )

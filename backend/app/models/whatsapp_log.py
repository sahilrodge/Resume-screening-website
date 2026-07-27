"""WhatsApp message log model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.enums import WhatsappDirection, WhatsappStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate
    from app.models.user import User


class WhatsappLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "whatsapp_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    to_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    from_number: Mapped[str] = mapped_column(String(30), nullable=False)
    direction: Mapped[WhatsappDirection] = mapped_column(
        SAEnum(
            WhatsappDirection,
            name="whatsapp_direction",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    status: Mapped[WhatsappStatus] = mapped_column(
        SAEnum(
            WhatsappStatus,
            name="whatsapp_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=WhatsappStatus.QUEUED,
        index=True,
    )
    message_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped[User | None] = relationship("User", back_populates="whatsapp_logs")
    candidate: Mapped[Candidate | None] = relationship("Candidate", back_populates="whatsapp_logs")

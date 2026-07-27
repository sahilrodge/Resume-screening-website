"""Remove WhatsApp/Twilio and Vapi/voice screening artifacts.

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-07-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("whatsapp_logs")
    op.drop_table("voice_calls")

    op.drop_column("notification_preferences", "whatsapp_enabled")
    op.drop_column("jobs", "screening_questions")

    op.execute("DELETE FROM notifications WHERE channel = 'whatsapp'")
    op.execute(
        "UPDATE interviews SET interview_type = 'phone' "
        "WHERE interview_type::text = 'ai_voice'"
    )

    op.execute("DROP TYPE IF EXISTS whatsapp_direction")
    op.execute("DROP TYPE IF EXISTS whatsapp_status")
    op.execute("DROP TYPE IF EXISTS voice_call_status")


def downgrade() -> None:
    whatsapp_direction = postgresql.ENUM(
        "inbound", "outbound", name="whatsapp_direction", create_type=False
    )
    whatsapp_status = postgresql.ENUM(
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        name="whatsapp_status",
        create_type=False,
    )
    voice_call_status = postgresql.ENUM(
        "initiated",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "no_answer",
        "busy",
        "cancelled",
        name="voice_call_status",
        create_type=False,
    )
    whatsapp_direction.create(op.get_bind(), checkfirst=True)
    whatsapp_status.create(op.get_bind(), checkfirst=True)
    voice_call_status.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "jobs",
        sa.Column(
            "screening_questions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "whatsapp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Minimal stub tables — full schema is not restored
    op.create_table(
        "voice_calls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "whatsapp_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

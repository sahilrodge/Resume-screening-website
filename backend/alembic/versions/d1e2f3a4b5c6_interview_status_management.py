"""Add confirmed/no_show interview statuses and status change tracking."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c0d1e2f3a4b5"
branch_labels = None
depends_on = None


def _add_enum_value(value: str) -> None:
    op.execute(
        sa.text(
            f"""
            DO $$ BEGIN
                ALTER TYPE interview_status ADD VALUE '{value}';
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def upgrade() -> None:
    _add_enum_value("confirmed")
    _add_enum_value("no_show")

    op.add_column(
        "interviews",
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interviews",
        sa.Column(
            "status_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    # Seed history for existing rows
    op.execute(
        sa.text(
            """
            UPDATE interviews
            SET status_changed_at = COALESCE(updated_at, created_at),
                status_history = jsonb_build_array(
                    jsonb_build_object(
                        'status', status::text,
                        'at', COALESCE(created_at, now())
                    )
                )
            WHERE status_history IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("interviews", "status_history")
    op.drop_column("interviews", "status_changed_at")

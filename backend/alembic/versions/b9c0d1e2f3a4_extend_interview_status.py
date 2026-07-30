"""Extend interview_status with in_progress, selected, rejected."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = "a8b9c0d1e2f3"
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
    # Legacy value no longer in the product status set
    op.execute(
        sa.text(
            "UPDATE interviews SET status = 'cancelled' "
            "WHERE status::text = 'no_show'"
        )
    )
    _add_enum_value("in_progress")
    _add_enum_value("selected")
    _add_enum_value("rejected")


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE interviews SET status = 'scheduled' "
            "WHERE status::text IN ('in_progress', 'selected')"
        )
    )
    op.execute(
        sa.text(
            "UPDATE interviews SET status = 'cancelled' "
            "WHERE status::text = 'rejected'"
        )
    )

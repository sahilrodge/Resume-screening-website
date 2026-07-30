"""Add interview_completed value to application_status enum."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                ALTER TYPE application_status ADD VALUE 'interview_completed';
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE applications SET status = 'interview' "
            "WHERE status::text = 'interview_completed'"
        )
    )

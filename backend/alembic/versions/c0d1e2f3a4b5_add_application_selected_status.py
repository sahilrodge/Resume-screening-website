"""Add selected value to application_status enum."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                ALTER TYPE application_status ADD VALUE 'selected';
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE applications SET status = 'shortlisted' "
            "WHERE status::text = 'selected'"
        )
    )

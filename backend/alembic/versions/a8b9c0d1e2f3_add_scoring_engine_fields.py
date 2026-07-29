"""Add scoring engine, confidence, and score fingerprint to applications."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("scoring_engine", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("confidence", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("score_fingerprint", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "score_fingerprint")
    op.drop_column("applications", "confidence")
    op.drop_column("applications", "scoring_engine")

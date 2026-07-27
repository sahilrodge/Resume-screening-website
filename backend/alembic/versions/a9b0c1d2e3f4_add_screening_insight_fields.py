"""Add ATS score and structured screening insights to applications.

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-07-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("ats_score", sa.Numeric(precision=5, scale=2), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("weaknesses", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column(
            "suggestions", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("applications", "suggestions")
    op.drop_column("applications", "weaknesses")
    op.drop_column("applications", "strengths")
    op.drop_column("applications", "ats_score")

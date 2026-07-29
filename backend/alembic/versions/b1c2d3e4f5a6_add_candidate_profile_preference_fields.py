"""Add candidate preference and personal profile fields.

Revision ID: b1c2d3e4f5a6
Revises: a9b0c1d2e3f4
Create Date: 2026-07-29
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("date_of_birth", sa.Date(), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column("preferred_job_role", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column("preferred_location", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column("expected_salary", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("candidates", "expected_salary")
    op.drop_column("candidates", "preferred_location")
    op.drop_column("candidates", "preferred_job_role")
    op.drop_column("candidates", "date_of_birth")

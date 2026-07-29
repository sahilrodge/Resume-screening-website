"""Extend companies with profile fields.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-29
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("employee_count", sa.String(length=60), nullable=True),
    )
    op.add_column("companies", sa.Column("culture", sa.Text(), nullable=True))
    op.add_column(
        "companies",
        sa.Column("benefits", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column(
            "social_links", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("companies", "social_links")
    op.drop_column("companies", "benefits")
    op.drop_column("companies", "culture")
    op.drop_column("companies", "employee_count")

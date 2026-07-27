"""add application match fields

Revision ID: a1b2c3d4e5f6
Revises: 3fe85525da4f
Create Date: 2026-07-27 12:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "3fe85525da4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("matching_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("missing_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("applications", sa.Column("reasoning", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "reasoning")
    op.drop_column("applications", "missing_skills")
    op.drop_column("applications", "matching_skills")

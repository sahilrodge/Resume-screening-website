"""Extend profiles: avatar, github, education/experience, nullable recruiter company.

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-07-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column(
        "candidates", sa.Column("github_url", sa.String(length=500), nullable=True)
    )
    op.add_column(
        "candidates",
        sa.Column("education", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column("experience", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.drop_constraint("recruiters_company_id_fkey", "recruiters", type_="foreignkey")
    op.alter_column(
        "recruiters",
        "company_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_foreign_key(
        "recruiters_company_id_fkey",
        "recruiters",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("recruiters_company_id_fkey", "recruiters", type_="foreignkey")
    op.execute(
        "UPDATE recruiters SET company_id = ("
        "SELECT id FROM companies ORDER BY created_at ASC LIMIT 1"
        ") WHERE company_id IS NULL"
    )
    op.alter_column(
        "recruiters",
        "company_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_foreign_key(
        "recruiters_company_id_fkey",
        "recruiters",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_column("candidates", "experience")
    op.drop_column("candidates", "education")
    op.drop_column("candidates", "github_url")
    op.drop_column("users", "avatar_url")

"""add assistant chat history tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-27 13:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    chat_role = postgresql.ENUM(
        "user",
        "assistant",
        "system",
        name="chat_role",
        create_type=False,
    )
    chat_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "assistant_conversations",
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=False),
        sa.Column("candidate_id", sa.UUID(), nullable=True),
        sa.Column("job_id", sa.UUID(), nullable=True),
        sa.Column("application_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assistant_conversations_created_by_user_id",
        "assistant_conversations",
        ["created_by_user_id"],
    )
    op.create_index(
        "ix_assistant_conversations_candidate_id",
        "assistant_conversations",
        ["candidate_id"],
    )
    op.create_index("ix_assistant_conversations_job_id", "assistant_conversations", ["job_id"])
    op.create_index(
        "ix_assistant_conversations_application_id",
        "assistant_conversations",
        ["application_id"],
    )

    op.create_table(
        "assistant_messages",
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("role", chat_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["assistant_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assistant_messages_conversation_id",
        "assistant_messages",
        ["conversation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assistant_messages_conversation_id", table_name="assistant_messages")
    op.drop_table("assistant_messages")
    op.drop_index(
        "ix_assistant_conversations_application_id",
        table_name="assistant_conversations",
    )
    op.drop_index("ix_assistant_conversations_job_id", table_name="assistant_conversations")
    op.drop_index(
        "ix_assistant_conversations_candidate_id",
        table_name="assistant_conversations",
    )
    op.drop_index(
        "ix_assistant_conversations_created_by_user_id",
        table_name="assistant_conversations",
    )
    op.drop_table("assistant_conversations")
    postgresql.ENUM(name="chat_role").drop(op.get_bind(), checkfirst=True)

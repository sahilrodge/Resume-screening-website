"""Assistant conversation data-access helpers."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.application import Application
from app.models.assistant import AssistantConversation, AssistantMessage
from app.models.candidate import Candidate
from app.models.enums import ChatRole
from app.models.job import Job


class CRUDAssistant:
    def get_conversation(
        self,
        db: Session,
        conversation_id: uuid.UUID,
    ) -> AssistantConversation | None:
        stmt = (
            select(AssistantConversation)
            .options(
                selectinload(AssistantConversation.messages),
                joinedload(AssistantConversation.candidate).joinedload(Candidate.user),
                joinedload(AssistantConversation.job).joinedload(Job.company),
                joinedload(AssistantConversation.application),
            )
            .where(AssistantConversation.id == conversation_id)
        )
        return db.scalars(stmt).unique().first()

    def list_conversations(
        self,
        db: Session,
        *,
        user_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[AssistantConversation], int]:
        filters = []
        if user_id is not None:
            filters.append(AssistantConversation.created_by_user_id == user_id)

        count_stmt = select(func.count()).select_from(AssistantConversation)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        stmt = (
            select(AssistantConversation)
            .options(
                selectinload(AssistantConversation.messages),
                joinedload(AssistantConversation.candidate).joinedload(Candidate.user),
                joinedload(AssistantConversation.job).joinedload(Job.company),
            )
            .order_by(desc(AssistantConversation.updated_at))
            .offset(skip)
            .limit(limit)
        )
        if filters:
            stmt = stmt.where(*filters)
        items = list(db.scalars(stmt).unique().all())
        return items, total

    def create_conversation(
        self,
        db: Session,
        *,
        created_by_user_id: uuid.UUID,
        title: str,
        candidate_id: uuid.UUID | None = None,
        job_id: uuid.UUID | None = None,
        application_id: uuid.UUID | None = None,
    ) -> AssistantConversation:
        obj = AssistantConversation(
            title=title,
            created_by_user_id=created_by_user_id,
            candidate_id=candidate_id,
            job_id=job_id,
            application_id=application_id,
        )
        db.add(obj)
        db.commit()
        return self.get_conversation(db, obj.id)  # type: ignore[return-value]

    def add_message(
        self,
        db: Session,
        *,
        conversation_id: uuid.UUID,
        role: ChatRole,
        content: str,
        meta: dict[str, Any] | None = None,
    ) -> AssistantMessage:
        from datetime import datetime, timezone

        msg = AssistantMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            meta=meta,
        )
        db.add(msg)
        conv = db.get(AssistantConversation, conversation_id)
        if conv:
            conv.updated_at = datetime.now(timezone.utc)
            db.add(conv)
        db.commit()
        db.refresh(msg)
        return msg

    def touch_title(self, db: Session, *, conversation_id: uuid.UUID, title: str) -> None:
        conv = db.get(AssistantConversation, conversation_id)
        if conv and (not conv.title or conv.title == "New chat"):
            conv.title = title[:255]
            db.add(conv)
            db.commit()

    def delete_message(self, db: Session, message_id: uuid.UUID) -> None:
        msg = db.get(AssistantMessage, message_id)
        if msg is None:
            return
        db.delete(msg)
        db.commit()


assistant = CRUDAssistant()

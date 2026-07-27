"""WhatsApp log data-access helpers."""

from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import Select, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.candidate import Candidate
from app.models.enums import WhatsappDirection, WhatsappStatus
from app.models.whatsapp_log import WhatsappLog


def _base_query() -> Select[tuple[WhatsappLog]]:
    return select(WhatsappLog).options(
        joinedload(WhatsappLog.candidate).joinedload(Candidate.user),
        joinedload(WhatsappLog.user),
    )


class CRUDWhatsappLog:
    def get(self, db: Session, log_id: uuid.UUID) -> WhatsappLog | None:
        stmt = _base_query().where(WhatsappLog.id == log_id)
        return db.scalars(stmt).unique().first()

    def get_by_provider_id(self, db: Session, provider_message_id: str) -> WhatsappLog | None:
        stmt = _base_query().where(WhatsappLog.provider_message_id == provider_message_id)
        return db.scalars(stmt).unique().first()

    def create(
        self,
        db: Session,
        *,
        to_number: str,
        from_number: str,
        direction: WhatsappDirection,
        status: WhatsappStatus,
        message_body: str | None = None,
        provider_message_id: str | None = None,
        error_message: str | None = None,
        candidate_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        meta: dict[str, Any] | None = None,
    ) -> WhatsappLog:
        log = WhatsappLog(
            to_number=to_number,
            from_number=from_number,
            direction=direction,
            status=status,
            message_body=message_body,
            provider_message_id=provider_message_id,
            error_message=error_message,
            candidate_id=candidate_id,
            user_id=user_id,
            meta=meta,
        )
        db.add(log)
        db.commit()
        return self.get(db, log.id)  # type: ignore[return-value]

    def update_status(
        self,
        db: Session,
        *,
        db_obj: WhatsappLog,
        status: WhatsappStatus,
        error_message: str | None = None,
    ) -> WhatsappLog:
        db_obj.status = status
        if error_message is not None:
            db_obj.error_message = error_message
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def find_candidate_by_phone(self, db: Session, phone: str) -> Candidate | None:
        cleaned = phone.replace("whatsapp:", "").strip()
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        if not digits:
            return None
        stmt = (
            select(Candidate)
            .options(joinedload(Candidate.user))
            .where(
                or_(
                    Candidate.phone == cleaned,
                    Candidate.phone == f"+{digits}",
                    Candidate.phone == digits,
                    func.replace(func.coalesce(Candidate.phone, ""), "+", "").like(f"%{digits[-10:]}%"),
                )
            )
        )
        return db.scalars(stmt).unique().first()

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        candidate_id: uuid.UUID | None = None,
        direction: WhatsappDirection | None = None,
        event_type: str | None = None,
    ) -> tuple[list[WhatsappLog], int, int]:
        filters: list[Any] = []
        if candidate_id is not None:
            filters.append(WhatsappLog.candidate_id == candidate_id)
        if direction is not None:
            filters.append(WhatsappLog.direction == direction)
        if event_type:
            filters.append(WhatsappLog.meta["event_type"].as_string() == event_type)

        count_stmt = select(func.count()).select_from(WhatsappLog)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        stmt = _base_query()
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(desc(WhatsappLog.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.scalars(stmt).unique().all())
        pages = max(1, math.ceil(total / page_size)) if total else 0
        return items, total, pages

    def reminder_already_sent(self, db: Session, interview_id: uuid.UUID) -> bool:
        stmt = (
            select(func.count())
            .select_from(WhatsappLog)
            .where(
                WhatsappLog.direction == WhatsappDirection.OUTBOUND,
                WhatsappLog.meta["event_type"].as_string() == "reminder",
                WhatsappLog.meta["interview_id"].as_string() == str(interview_id),
            )
        )
        return (db.scalar(stmt) or 0) > 0


whatsapp_log = CRUDWhatsappLog()

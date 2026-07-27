"""Voice call data-access helpers."""

from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import Select, desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.enums import VoiceCallStatus
from app.models.job import Job
from app.models.voice_call import VoiceCall


def _base_query() -> Select[tuple[VoiceCall]]:
    return select(VoiceCall).options(
        joinedload(VoiceCall.candidate).joinedload(Candidate.user),
        joinedload(VoiceCall.application).joinedload(Application.job).joinedload(Job.company),
        joinedload(VoiceCall.user),
    )


class CRUDVoiceCall:
    def get(self, db: Session, call_id: uuid.UUID) -> VoiceCall | None:
        stmt = _base_query().where(VoiceCall.id == call_id)
        return db.scalars(stmt).unique().first()

    def get_by_provider_id(self, db: Session, provider_call_id: str) -> VoiceCall | None:
        stmt = _base_query().where(VoiceCall.provider_call_id == provider_call_id)
        return db.scalars(stmt).unique().first()

    def create(
        self,
        db: Session,
        *,
        to_number: str,
        from_number: str,
        status: VoiceCallStatus = VoiceCallStatus.INITIATED,
        candidate_id: uuid.UUID | None = None,
        application_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        provider_call_id: str | None = None,
        error_message: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> VoiceCall:
        call = VoiceCall(
            to_number=to_number,
            from_number=from_number,
            status=status,
            candidate_id=candidate_id,
            application_id=application_id,
            user_id=user_id,
            provider_call_id=provider_call_id,
            error_message=error_message,
            meta=meta,
        )
        db.add(call)
        db.commit()
        return self.get(db, call.id)  # type: ignore[return-value]

    def update(
        self,
        db: Session,
        *,
        db_obj: VoiceCall,
        **fields: Any,
    ) -> VoiceCall:
        for key, value in fields.items():
            if value is not None or key in {"transcript", "error_message", "meta", "recording_url"}:
                setattr(db_obj, key, value)
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        application_id: uuid.UUID | None = None,
        candidate_id: uuid.UUID | None = None,
        status: VoiceCallStatus | None = None,
    ) -> tuple[list[VoiceCall], int, int]:
        filters: list[Any] = []
        if application_id is not None:
            filters.append(VoiceCall.application_id == application_id)
        if candidate_id is not None:
            filters.append(VoiceCall.candidate_id == candidate_id)
        if status is not None:
            filters.append(VoiceCall.status == status)

        count_stmt = select(func.count()).select_from(VoiceCall)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        stmt = _base_query()
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(desc(VoiceCall.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.scalars(stmt).unique().all())
        pages = max(1, math.ceil(total / page_size)) if total else 0
        return items, total, pages


voice_call = CRUDVoiceCall()

"""Application data-access helpers."""

from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.enums import ApplicationStatus
from app.models.job import Job
from app.schemas.application import ApplicationSortField, SortOrder
from app.schemas.match_result import MatchResult


def _base_query() -> Select[tuple[Application]]:
    return select(Application).options(
        joinedload(Application.job).joinedload(Job.company),
        joinedload(Application.candidate).joinedload(Candidate.user),
        joinedload(Application.resume),
    )


class CRUDApplication:
    def get(self, db: Session, application_id: uuid.UUID) -> Application | None:
        stmt = _base_query().where(Application.id == application_id)
        return db.scalars(stmt).unique().first()

    def get_by_job_candidate(
        self,
        db: Session,
        *,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
    ) -> Application | None:
        stmt = _base_query().where(
            Application.job_id == job_id,
            Application.candidate_id == candidate_id,
        )
        return db.scalars(stmt).unique().first()

    def create(
        self,
        db: Session,
        *,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
        resume_id: uuid.UUID | None,
        status: ApplicationStatus = ApplicationStatus.SCREENING,
    ) -> Application:
        app = Application(
            job_id=job_id,
            candidate_id=candidate_id,
            resume_id=resume_id,
            status=status,
        )
        db.add(app)
        db.commit()
        return self.get(db, app.id)  # type: ignore[return-value]

    def save_match_result(
        self,
        db: Session,
        *,
        db_obj: Application,
        resume_id: uuid.UUID,
        match: MatchResult,
        status: ApplicationStatus = ApplicationStatus.SCREENING,
    ) -> Application:
        db_obj.resume_id = resume_id
        db_obj.match_score = match.match_score
        db_obj.ats_score = match.ats_score
        db_obj.matching_skills = match.matching_skills
        db_obj.missing_skills = match.missing_skills
        db_obj.strengths = match.strengths
        db_obj.weaknesses = match.weaknesses
        db_obj.suggestions = match.suggestions
        db_obj.ai_summary = match.summary
        db_obj.reasoning = match.reasoning
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def update_status(
        self,
        db: Session,
        *,
        db_obj: Application,
        status: ApplicationStatus,
    ) -> Application:
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        job_id: uuid.UUID | None = None,
        candidate_id: uuid.UUID | None = None,
        status: ApplicationStatus | None = None,
        sort_by: ApplicationSortField = "created_at",
        sort_order: SortOrder = "desc",
    ) -> tuple[list[Application], int, int]:
        filters: list[Any] = []
        if job_id is not None:
            filters.append(Application.job_id == job_id)
        if candidate_id is not None:
            filters.append(Application.candidate_id == candidate_id)
        if status is not None:
            filters.append(Application.status == status)

        count_stmt = select(func.count()).select_from(Application)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        sort_map = {
            "created_at": Application.created_at,
            "match_score": Application.match_score,
            "status": Application.status,
        }
        sort_col = sort_map[sort_by]
        order_expr = asc(sort_col) if sort_order == "asc" else desc(sort_col)

        stmt = _base_query()
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(order_expr, desc(Application.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.scalars(stmt).unique().all())
        pages = max(1, math.ceil(total / page_size)) if total else 0
        return items, total, pages


application = CRUDApplication()

"""Interview data-access helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.enums import InterviewStatus, InterviewType
from app.models.interview import Interview
from app.models.job import Job


class CRUDInterview:
    def get(self, db: Session, interview_id: uuid.UUID) -> Interview | None:
        stmt = (
            select(Interview)
            .options(
                joinedload(Interview.application)
                .joinedload(Application.job)
                .joinedload(Job.company),
                joinedload(Interview.application)
                .joinedload(Application.candidate)
                .joinedload(Candidate.user),
            )
            .where(Interview.id == interview_id)
        )
        return db.scalars(stmt).unique().first()

    def create(
        self,
        db: Session,
        *,
        application_id: uuid.UUID,
        scheduled_at,
        interview_type: InterviewType = InterviewType.VIDEO,
        duration_minutes: int = 60,
        meeting_link: str | None = None,
        location: str | None = None,
        interviewer_id: uuid.UUID | None = None,
    ) -> Interview:
        interview = Interview(
            application_id=application_id,
            scheduled_at=scheduled_at,
            interview_type=interview_type,
            duration_minutes=duration_minutes,
            meeting_link=meeting_link,
            location=location,
            interviewer_id=interviewer_id,
            status=InterviewStatus.SCHEDULED,
        )
        db.add(interview)
        db.commit()
        return self.get(db, interview.id)  # type: ignore[return-value]

    def list(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        application_id: uuid.UUID | None = None,
        candidate_id: uuid.UUID | None = None,
    ) -> tuple[list[Interview], int]:
        filters = []
        if application_id:
            filters.append(Interview.application_id == application_id)
        if candidate_id:
            filters.append(Application.candidate_id == candidate_id)

        count_stmt = select(func.count()).select_from(Interview)
        if candidate_id:
            count_stmt = count_stmt.join(
                Application, Interview.application_id == Application.id
            )
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        stmt = (
            select(Interview)
            .options(
                joinedload(Interview.application)
                .joinedload(Application.job)
                .joinedload(Job.company),
                joinedload(Interview.application)
                .joinedload(Application.candidate)
                .joinedload(Candidate.user),
            )
            .order_by(desc(Interview.scheduled_at))
            .offset(skip)
            .limit(limit)
        )
        if candidate_id:
            stmt = stmt.join(Application, Interview.application_id == Application.id)
        if filters:
            stmt = stmt.where(*filters)
        items = list(db.scalars(stmt).unique().all())
        return items, total

    def update_status(
        self,
        db: Session,
        *,
        db_obj: Interview,
        status: InterviewStatus,
    ) -> Interview:
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]


interview = CRUDInterview()

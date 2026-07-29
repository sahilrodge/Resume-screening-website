"""Saved job business logic."""

from __future__ import annotations

import math
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.crud.job import job as job_crud
from app.crud.saved_job import saved_job as saved_job_crud
from app.models.enums import JobStatus
from app.schemas.common import MessageResponse
from app.schemas.saved_job import SavedJobIdsResponse, SavedJobListResponse, SavedJobResponse
from app.services.job import _to_response


class SavedJobService:
    def list_mine(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> SavedJobListResponse:
        items, total = saved_job_crud.list_jobs(
            db, candidate_id=candidate_id, page=page, page_size=page_size
        )
        pages = math.ceil(total / page_size) if total else 0
        return SavedJobListResponse(
            items=[_to_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def saved_ids(self, db: Session, *, candidate_id: uuid.UUID) -> SavedJobIdsResponse:
        ids = saved_job_crud.list_job_ids(db, candidate_id=candidate_id)
        return SavedJobIdsResponse(job_ids=sorted(ids, key=str))

    def save(
        self, db: Session, *, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> SavedJobResponse:
        job = job_crud.get(db, job_id)
        if job is None or job.status != JobStatus.OPEN:
            raise NotFoundError("Job not found")
        row = saved_job_crud.save(db, candidate_id=candidate_id, job_id=job_id)
        return SavedJobResponse(
            id=row.id,
            job_id=row.job_id,
            candidate_id=row.candidate_id,
            created_at=row.created_at,
            job=_to_response(job),
        )

    def unsave(
        self, db: Session, *, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> MessageResponse:
        saved_job_crud.unsave(db, candidate_id=candidate_id, job_id=job_id)
        return MessageResponse(message="Job removed from saved list")


saved_job_service = SavedJobService()

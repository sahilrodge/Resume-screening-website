"""Saved job data-access helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.job import Job
from app.models.recruiter import Recruiter
from app.models.saved_job import SavedJob
from app.models.skill import JobSkill


class CRUDSavedJob:
    def get(
        self, db: Session, *, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> SavedJob | None:
        return db.scalar(
            select(SavedJob).where(
                SavedJob.candidate_id == candidate_id,
                SavedJob.job_id == job_id,
            )
        )

    def list_job_ids(self, db: Session, *, candidate_id: uuid.UUID) -> set[uuid.UUID]:
        rows = db.scalars(
            select(SavedJob.job_id).where(SavedJob.candidate_id == candidate_id)
        ).all()
        return set(rows)

    def list_jobs(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Job], int]:
        count_stmt = (
            select(func.count())
            .select_from(SavedJob)
            .where(SavedJob.candidate_id == candidate_id)
        )
        total = db.scalar(count_stmt) or 0
        stmt = (
            select(Job)
            .join(SavedJob, SavedJob.job_id == Job.id)
            .where(SavedJob.candidate_id == candidate_id)
            .options(
                joinedload(Job.company),
                joinedload(Job.recruiter).joinedload(Recruiter.user),
                selectinload(Job.applications),
                selectinload(Job.skills).joinedload(JobSkill.skill),
            )
            .order_by(SavedJob.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.scalars(stmt).unique().all())
        return items, total

    def save(
        self, db: Session, *, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> SavedJob:
        existing = self.get(db, candidate_id=candidate_id, job_id=job_id)
        if existing is not None:
            return existing
        row = SavedJob(candidate_id=candidate_id, job_id=job_id)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def unsave(
        self, db: Session, *, candidate_id: uuid.UUID, job_id: uuid.UUID
    ) -> bool:
        result = db.execute(
            delete(SavedJob).where(
                SavedJob.candidate_id == candidate_id,
                SavedJob.job_id == job_id,
            )
        )
        db.commit()
        return bool(result.rowcount)


saved_job = CRUDSavedJob()

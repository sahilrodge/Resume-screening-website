"""Job data-access helpers with search, filters, and application counts."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.application import Application
from app.models.company import Company
from app.models.enums import EmploymentType, JobStatus
from app.models.job import Job
from app.models.recruiter import Recruiter
from app.models.skill import JobSkill
from app.schemas.job import JobCreate, JobSortField, JobUpdate, SortOrder


def _base_query() -> Select[tuple[Job]]:
    return select(Job).options(
        joinedload(Job.company),
        joinedload(Job.recruiter).joinedload(Recruiter.user),
        selectinload(Job.applications),
        selectinload(Job.skills).joinedload(JobSkill.skill),
    )


class CRUDJob:
    def get(self, db: Session, job_id: uuid.UUID) -> Job | None:
        stmt = _base_query().where(Job.id == job_id)
        return db.scalars(stmt).unique().first()

    def create(self, db: Session, *, obj_in: JobCreate) -> Job:
        data = obj_in.model_dump()
        status = data.get("status", JobStatus.DRAFT)
        published_at = None
        if status == JobStatus.OPEN:
            published_at = datetime.now(timezone.utc)

        job = Job(**data, published_at=published_at)
        db.add(job)
        db.commit()
        return self.get(db, job.id)  # type: ignore[return-value]

    def update(self, db: Session, *, db_obj: Job, obj_in: JobUpdate) -> Job:
        data = obj_in.model_dump(exclude_unset=True)
        previous_status = db_obj.status

        for field, value in data.items():
            setattr(db_obj, field, value)

        new_status = data.get("status")
        if new_status == JobStatus.OPEN and previous_status != JobStatus.OPEN:
            if db_obj.published_at is None:
                db_obj.published_at = datetime.now(timezone.utc)

        db.add(db_obj)
        db.commit()
        return self.get(db, db_obj.id)  # type: ignore[return-value]

    def delete(self, db: Session, *, db_obj: Job) -> None:
        db.delete(db_obj)
        db.commit()

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        status: JobStatus | None = None,
        employment_type: EmploymentType | None = None,
        location: str | None = None,
        company_id: uuid.UUID | None = None,
        recruiter_id: uuid.UUID | None = None,
        sort_by: JobSortField = "created_at",
        sort_order: SortOrder = "desc",
    ) -> tuple[list[Job], int, int]:
        filters: list[Any] = []

        if search:
            term = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(Job.title).like(term),
                    func.lower(Job.description).like(term),
                    func.lower(Job.location).like(term),
                    func.lower(Company.name).like(term),
                )
            )

        if status is not None:
            filters.append(Job.status == status)
        if employment_type is not None:
            filters.append(Job.employment_type == employment_type)
        if location:
            filters.append(func.lower(Job.location).like(f"%{location.strip().lower()}%"))
        if company_id is not None:
            filters.append(Job.company_id == company_id)
        if recruiter_id is not None:
            filters.append(Job.recruiter_id == recruiter_id)

        count_stmt = select(func.count()).select_from(Job).join(Company)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.scalar(count_stmt) or 0

        app_count = (
            select(func.count(Application.id))
            .where(Application.job_id == Job.id)
            .correlate(Job)
            .scalar_subquery()
        )

        sort_map = {
            "created_at": Job.created_at,
            "title": Job.title,
            "status": Job.status,
            "location": Job.location,
            "employment_type": Job.employment_type,
            "published_at": Job.published_at,
            "application_count": app_count,
        }
        sort_col = sort_map[sort_by]
        order_expr = asc(sort_col) if sort_order == "asc" else desc(sort_col)

        stmt = _base_query().join(Company)
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(order_expr, desc(Job.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        items = list(db.scalars(stmt).unique().all())
        pages = max(1, math.ceil(total / page_size)) if total else 0
        return items, total, pages

    def dashboard_stats(self, db: Session) -> dict[str, int]:
        total_jobs = db.scalar(select(func.count()).select_from(Job)) or 0
        open_jobs = (
            db.scalar(
                select(func.count()).select_from(Job).where(Job.status == JobStatus.OPEN)
            )
            or 0
        )
        draft_jobs = (
            db.scalar(
                select(func.count()).select_from(Job).where(Job.status == JobStatus.DRAFT)
            )
            or 0
        )
        closed_jobs = (
            db.scalar(
                select(func.count()).select_from(Job).where(Job.status == JobStatus.CLOSED)
            )
            or 0
        )
        filled_jobs = (
            db.scalar(
                select(func.count()).select_from(Job).where(Job.status == JobStatus.FILLED)
            )
            or 0
        )
        total_applications = db.scalar(select(func.count()).select_from(Application)) or 0
        return {
            "total_jobs": total_jobs,
            "open_jobs": open_jobs,
            "draft_jobs": draft_jobs,
            "closed_jobs": closed_jobs,
            "filled_jobs": filled_jobs,
            "total_applications": total_applications,
        }

    def company_exists(self, db: Session, company_id: uuid.UUID) -> bool:
        return db.scalar(select(func.count()).select_from(Company).where(Company.id == company_id)) == 1

    def recruiter_exists(self, db: Session, recruiter_id: uuid.UUID) -> bool:
        return (
            db.scalar(
                select(func.count()).select_from(Recruiter).where(Recruiter.id == recruiter_id)
            )
            == 1
        )


job = CRUDJob()

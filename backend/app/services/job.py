"""Job business logic."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.crud.job import job as job_crud
from app.models.enums import EmploymentType, JobStatus
from app.models.job import Job
from app.schemas.job import (
    JobCreate,
    JobDashboardStats,
    JobListResponse,
    JobResponse,
    JobSortField,
    JobUpdate,
    SortOrder,
)


def _to_response(obj: Job) -> JobResponse:
    recruiter_name = None
    if obj.recruiter and obj.recruiter.user:
        recruiter_name = obj.recruiter.user.full_name

    salary_min = float(obj.salary_min) if obj.salary_min is not None else None
    salary_max = float(obj.salary_max) if obj.salary_max is not None else None
    skills = [
        link.skill.name
        for link in (obj.skills or [])
        if link.skill is not None and link.skill.name
    ]

    return JobResponse(
        id=obj.id,
        company_id=obj.company_id,
        company_name=obj.company.name if obj.company else None,
        company_logo_url=None,  # Always use HirePulse brand mark in the UI — no external logos
        recruiter_id=obj.recruiter_id,
        recruiter_name=recruiter_name,
        title=obj.title,
        description=obj.description,
        location=obj.location,
        employment_type=obj.employment_type,
        status=obj.status,
        salary_min=salary_min,
        salary_max=salary_max,
        currency=obj.currency,
        experience_min_years=obj.experience_min_years,
        experience_max_years=obj.experience_max_years,
        openings=obj.openings,
        application_count=len(obj.applications) if obj.applications is not None else 0,
        skills=skills,
        published_at=obj.published_at,
        closes_at=obj.closes_at,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


class JobService:
    def create(self, db: Session, *, data: JobCreate) -> JobResponse:
        if not job_crud.company_exists(db, data.company_id):
            raise NotFoundError("Company not found")
        if data.recruiter_id and not job_crud.recruiter_exists(db, data.recruiter_id):
            raise NotFoundError("Recruiter not found")
        created = job_crud.create(db, obj_in=data)
        return _to_response(created)

    def get(self, db: Session, job_id: uuid.UUID) -> JobResponse:
        obj = job_crud.get(db, job_id)
        if obj is None:
            raise NotFoundError("Job not found")
        return _to_response(obj)

    def update(self, db: Session, job_id: uuid.UUID, *, data: JobUpdate) -> JobResponse:
        obj = job_crud.get(db, job_id)
        if obj is None:
            raise NotFoundError("Job not found")
        if data.company_id is not None and not job_crud.company_exists(db, data.company_id):
            raise NotFoundError("Company not found")
        if data.recruiter_id is not None and not job_crud.recruiter_exists(db, data.recruiter_id):
            raise NotFoundError("Recruiter not found")
        updated = job_crud.update(db, db_obj=obj, obj_in=data)
        return _to_response(updated)

    def delete(self, db: Session, job_id: uuid.UUID) -> None:
        obj = job_crud.get(db, job_id)
        if obj is None:
            raise NotFoundError("Job not found")
        job_crud.delete(db, db_obj=obj)

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
    ) -> JobListResponse:
        items, total, pages = job_crud.list(
            db,
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            employment_type=employment_type,
            location=location,
            company_id=company_id,
            recruiter_id=recruiter_id,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return JobListResponse(
            items=[_to_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def dashboard_stats(self, db: Session) -> JobDashboardStats:
        return JobDashboardStats(**job_crud.dashboard_stats(db))


job_service = JobService()

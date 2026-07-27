"""Job CRUD endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, RecruiterUser
from app.models.enums import EmploymentType, JobStatus
from app.schemas.common import MessageResponse
from app.schemas.job import (
    JobCreate,
    JobDashboardStats,
    JobListResponse,
    JobResponse,
    JobSortField,
    JobUpdate,
    SortOrder,
)
from app.services.job import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get(
    "/dashboard-stats",
    response_model=JobDashboardStats,
    summary="Recruiter dashboard job stats",
)
def job_dashboard_stats(
    db: DBSession,
    _: RecruiterUser,
) -> JobDashboardStats:
    return job_service.dashboard_stats(db)


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create job",
)
def create_job(
    payload: JobCreate,
    db: DBSession,
    _: RecruiterUser,
) -> JobResponse:
    return job_service.create(db, data=payload)


@router.get(
    "",
    response_model=JobListResponse,
    summary="List / search jobs",
)
def list_jobs(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    search: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[JobStatus | None, Query(alias="status")] = None,
    employment_type: EmploymentType | None = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
    company_id: uuid.UUID | None = None,
    recruiter_id: uuid.UUID | None = None,
    sort_by: JobSortField = "created_at",
    sort_order: SortOrder = "desc",
) -> JobListResponse:
    return job_service.list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        employment_type=employment_type,
        location=location,
        company_id=company_id,
        recruiter_id=recruiter_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job details",
)
def get_job(
    job_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> JobResponse:
    return job_service.get(db, job_id)


@router.patch(
    "/{job_id}",
    response_model=JobResponse,
    summary="Update job",
)
def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    db: DBSession,
    _: RecruiterUser,
) -> JobResponse:
    return job_service.update(db, job_id, data=payload)


@router.delete(
    "/{job_id}",
    response_model=MessageResponse,
    summary="Delete job",
)
def delete_job(
    job_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> MessageResponse:
    job_service.delete(db, job_id)
    return MessageResponse(message="Job deleted successfully")

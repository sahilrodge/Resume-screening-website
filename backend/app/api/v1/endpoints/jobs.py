"""Job CRUD endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CandidateUser, CurrentUser, DBSession, RecruiterUser
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.enums import EmploymentType, JobStatus, UserRole
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
from app.schemas.saved_job import SavedJobIdsResponse, SavedJobListResponse, SavedJobResponse
from app.services.candidate import candidate_service
from app.services.job import job_service
from app.services.saved_job import saved_job_service

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
    "/open",
    response_model=JobListResponse,
    summary="List open jobs (any authenticated role)",
)
def list_open_jobs(
    db: DBSession,
    _: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=120)] = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
) -> JobListResponse:
    return job_service.list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=JobStatus.OPEN,
        location=location,
        sort_by="created_at",
        sort_order="desc",
    )


@router.get(
    "/saved",
    response_model=SavedJobListResponse,
    summary="List jobs saved by the current candidate",
)
def list_saved_jobs(
    db: DBSession,
    current_user: CandidateUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SavedJobListResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return saved_job_service.list_mine(
        db, candidate_id=me.id, page=page, page_size=page_size
    )


@router.get(
    "/saved/ids",
    response_model=SavedJobIdsResponse,
    summary="List saved job IDs for the current candidate",
)
def list_saved_job_ids(
    db: DBSession,
    current_user: CandidateUser,
) -> SavedJobIdsResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return saved_job_service.saved_ids(db, candidate_id=me.id)


@router.post(
    "/{job_id}/save",
    response_model=SavedJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save / bookmark a job",
)
def save_job(
    job_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
) -> SavedJobResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return saved_job_service.save(db, candidate_id=me.id, job_id=job_id)


@router.delete(
    "/{job_id}/save",
    response_model=MessageResponse,
    summary="Remove a job from saved list",
)
def unsave_job(
    job_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
) -> MessageResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return saved_job_service.unsave(db, candidate_id=me.id, job_id=job_id)


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job details",
)
def get_job(
    job_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> JobResponse:
    job = job_service.get(db, job_id)
    if current_user.role == UserRole.CANDIDATE:
        if job.status != JobStatus.OPEN:
            raise NotFoundError("Job not found")
        return job
    if current_user.role in {UserRole.ADMIN, UserRole.RECRUITER}:
        return job
    raise ForbiddenError("Insufficient permissions")


@router.patch(
    "/{job_id}",
    response_model=JobResponse,
    summary="Update job",
)
def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    db: DBSession,
    current_user: RecruiterUser,
) -> JobResponse:
    from app.core.tenancy import assert_can_manage_job_company
    from app.crud.job import job as job_crud

    existing = job_crud.get(db, job_id)
    if existing is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Job not found")
    assert_can_manage_job_company(db, current_user, existing.company_id)
    return job_service.update(db, job_id, data=payload)


@router.delete(
    "/{job_id}",
    response_model=MessageResponse,
    summary="Delete job",
)
def delete_job(
    job_id: uuid.UUID,
    db: DBSession,
    current_user: RecruiterUser,
) -> MessageResponse:
    from app.core.tenancy import assert_can_manage_job_company
    from app.crud.job import job as job_crud

    existing = job_crud.get(db, job_id)
    if existing is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Job not found")
    assert_can_manage_job_company(db, current_user, existing.company_id)
    job_service.delete(db, job_id)
    return MessageResponse(message="Job deleted successfully")

"""Application / resume-job match endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, RecruiterUser
from app.models.enums import ApplicationStatus
from app.schemas.application import (
    ApplicationCompareRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationSortField,
    ApplicationStatusUpdate,
    SortOrder,
)
from app.services.application import application_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post(
    "/compare",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare resume with job description (OpenAI)",
)
def compare_resume_job(
    payload: ApplicationCompareRequest,
    db: DBSession,
    _: RecruiterUser,
) -> ApplicationResponse:
    return application_service.compare(db, data=payload)


@router.get(
    "",
    response_model=ApplicationListResponse,
    summary="List applications / match results",
)
def list_applications(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    job_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    sort_by: ApplicationSortField = "created_at",
    sort_order: SortOrder = "desc",
) -> ApplicationListResponse:
    return application_service.list(
        db,
        page=page,
        page_size=page_size,
        job_id=job_id,
        candidate_id=candidate_id,
        status=status_filter,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="Get application match details",
)
def get_application(
    application_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> ApplicationResponse:
    return application_service.get(db, application_id)


@router.patch(
    "/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status (triggers WhatsApp)",
)
def update_application_status(
    application_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    db: DBSession,
    _: RecruiterUser,
) -> ApplicationResponse:
    return application_service.update_status(db, application_id, data=payload)

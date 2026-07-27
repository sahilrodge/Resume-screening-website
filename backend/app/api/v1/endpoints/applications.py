"""Application / resume-job match endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import Response

from app.api.deps import CandidateUser, CurrentUser, DBSession, RecruiterUser
from app.core.exceptions import ForbiddenError
from app.models.enums import ApplicationStatus, UserRole
from app.schemas.application import (
    ApplicationApplyRequest,
    ApplicationCompareRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationSortField,
    ApplicationStatusUpdate,
    SortOrder,
)
from app.services.application import application_service
from app.services.candidate import candidate_service

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


@router.post(
    "/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Candidate apply to an open job",
)
def apply_to_job(
    payload: ApplicationApplyRequest,
    db: DBSession,
    current_user: CandidateUser,
) -> ApplicationResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return application_service.apply(db, candidate_id=me.id, data=payload)


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
    "/me",
    response_model=ApplicationListResponse,
    summary="List applications for the authenticated candidate",
)
def list_my_applications(
    db: DBSession,
    current_user: CandidateUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    sort_by: ApplicationSortField = "created_at",
    sort_order: SortOrder = "desc",
) -> ApplicationListResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return application_service.list(
        db,
        page=page,
        page_size=page_size,
        candidate_id=me.id,
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


@router.get(
    "/{application_id}/report",
    summary="Download screening report (Markdown)",
)
def download_screening_report(
    application_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> Response:
    """Recruiters can download any report; candidates only their own."""
    result = application_service.get(db, application_id)
    if current_user.role == UserRole.CANDIDATE:
        me = candidate_service.get_by_user_id(db, current_user.id)
        if result.candidate_id != me.id:
            raise ForbiddenError("Not allowed to download this report")
    elif current_user.role not in (UserRole.ADMIN, UserRole.RECRUITER):
        raise ForbiddenError("Insufficient permissions")

    filename, body = application_service.build_report(db, application_id)
    return Response(
        content=body.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.patch(
    "/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status",
)
def update_application_status(
    application_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    db: DBSession,
    _: RecruiterUser,
) -> ApplicationResponse:
    return application_service.update_status(db, application_id, data=payload)

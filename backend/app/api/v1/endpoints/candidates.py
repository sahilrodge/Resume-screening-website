"""Candidate CRUD endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CandidateUser, DBSession, RecruiterUser
from app.schemas.candidate import (
    CandidateCreate,
    CandidateListResponse,
    CandidateProfileResponse,
    CandidateResponse,
    CandidateSortField,
    CandidateUpdate,
    SortOrder,
)
from app.schemas.candidate_overview import CandidateOverviewResponse
from app.schemas.common import MessageResponse
from app.services.candidate import candidate_service
from app.services.candidate_overview import candidate_overview_service

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.post(
    "",
    response_model=CandidateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create candidate",
)
def create_candidate(
    payload: CandidateCreate,
    db: DBSession,
    _: RecruiterUser,
) -> CandidateResponse:
    return candidate_service.create(db, data=payload)


@router.get(
    "",
    response_model=CandidateListResponse,
    summary="List / search candidates",
)
def list_candidates(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    search: Annotated[str | None, Query(max_length=120)] = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
    min_experience: Annotated[int | None, Query(ge=0, le=80)] = None,
    max_experience: Annotated[int | None, Query(ge=0, le=80)] = None,
    is_active: bool | None = None,
    sort_by: CandidateSortField = "created_at",
    sort_order: SortOrder = "desc",
) -> CandidateListResponse:
    return candidate_service.list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        location=location,
        min_experience=min_experience,
        max_experience=max_experience,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/me",
    response_model=CandidateResponse,
    summary="Get the authenticated candidate profile",
)
def get_my_candidate(
    db: DBSession,
    current_user: CandidateUser,
) -> CandidateResponse:
    return candidate_service.get_by_user_id(db, current_user.id)


@router.get(
    "/me/profile",
    response_model=CandidateProfileResponse,
    summary="Get the authenticated candidate profile with resume data",
)
def get_my_candidate_profile(
    db: DBSession,
    current_user: CandidateUser,
) -> CandidateProfileResponse:
    return candidate_service.get_profile_by_user_id(db, current_user.id)


@router.get(
    "/me/overview",
    response_model=CandidateOverviewResponse,
    summary="Synced candidate overview (profile, resume, jobs, screening, interviews, notifications)",
)
def get_my_candidate_overview(
    db: DBSession,
    current_user: CandidateUser,
) -> CandidateOverviewResponse:
    return candidate_overview_service.get_overview(db, user=current_user)


@router.patch(
    "/me",
    response_model=CandidateResponse,
    summary="Update the authenticated candidate profile",
)
def update_my_candidate(
    payload: CandidateUpdate,
    db: DBSession,
    current_user: CandidateUser,
) -> CandidateResponse:
    return candidate_service.update_by_user_id(db, current_user.id, data=payload)


@router.get(
    "/{candidate_id}",
    response_model=CandidateResponse,
    summary="Get candidate",
)
def get_candidate(
    candidate_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> CandidateResponse:
    return candidate_service.get(db, candidate_id)


@router.get(
    "/{candidate_id}/profile",
    response_model=CandidateProfileResponse,
    summary="Get candidate profile with parsed resume data",
)
def get_candidate_profile(
    candidate_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> CandidateProfileResponse:
    return candidate_service.get_profile(db, candidate_id)


@router.patch(
    "/{candidate_id}",
    response_model=CandidateResponse,
    summary="Update candidate",
)
def update_candidate(
    candidate_id: uuid.UUID,
    payload: CandidateUpdate,
    db: DBSession,
    _: RecruiterUser,
) -> CandidateResponse:
    return candidate_service.update(db, candidate_id, data=payload)


@router.delete(
    "/{candidate_id}",
    response_model=MessageResponse,
    summary="Delete candidate",
)
def delete_candidate(
    candidate_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> MessageResponse:
    candidate_service.delete(db, candidate_id)
    return MessageResponse(message="Candidate deleted successfully")

"""Interview endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, RecruiterUser
from app.schemas.interview import InterviewCreate, InterviewListResponse, InterviewResponse
from app.services.interview import interview_service

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post(
    "",
    response_model=InterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule interview (sends WhatsApp invite)",
)
def create_interview(
    payload: InterviewCreate,
    db: DBSession,
    _: RecruiterUser,
) -> InterviewResponse:
    return interview_service.create(db, data=payload)


@router.get(
    "",
    response_model=InterviewListResponse,
    summary="List interviews",
)
def list_interviews(
    db: DBSession,
    _: RecruiterUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    application_id: uuid.UUID | None = None,
) -> InterviewListResponse:
    return interview_service.list(
        db,
        page=page,
        page_size=page_size,
        application_id=application_id,
    )


@router.get(
    "/{interview_id}",
    response_model=InterviewResponse,
    summary="Get interview",
)
def get_interview(
    interview_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> InterviewResponse:
    return interview_service.get(db, interview_id)

"""Resume upload, list, preview, and download endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import RedirectResponse

from app.api.deps import CandidateUser, DBSession, RecruiterUser
from app.schemas.common import MessageResponse
from app.schemas.resume import ResumeListResponse, ResumePreviewResponse, ResumeResponse
from app.services.candidate import candidate_service
from app.services.resume import resume_service

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.post(
    "/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload PDF resume to Cloudinary",
)
async def upload_resume(
    db: DBSession,
    _: RecruiterUser,
    candidate_id: Annotated[uuid.UUID, Form(...)],
    file: Annotated[UploadFile, File(..., description="PDF file")],
    is_primary: Annotated[bool, Form()] = False,
) -> ResumeResponse:
    return await resume_service.upload(
        db,
        candidate_id=candidate_id,
        file=file,
        is_primary=is_primary,
    )


@router.post(
    "/me/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Candidate upload own resume",
)
async def upload_my_resume(
    db: DBSession,
    current_user: CandidateUser,
    file: Annotated[UploadFile, File(..., description="PDF file")],
    is_primary: Annotated[bool, Form()] = True,
) -> ResumeResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return await resume_service.upload(
        db,
        candidate_id=me.id,
        file=file,
        is_primary=is_primary,
    )


@router.get(
    "/me",
    response_model=ResumeListResponse,
    summary="List resumes for the authenticated candidate",
)
def list_my_resumes(
    db: DBSession,
    current_user: CandidateUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResumeListResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return resume_service.list(
        db,
        candidate_id=me.id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "",
    response_model=ResumeListResponse,
    summary="List resumes",
)
def list_resumes(
    db: DBSession,
    _: RecruiterUser,
    candidate_id: uuid.UUID | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResumeListResponse:
    return resume_service.list(
        db,
        candidate_id=candidate_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{resume_id}",
    response_model=ResumeResponse,
    summary="Get resume metadata",
)
def get_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> ResumeResponse:
    return resume_service.get(db, resume_id)


@router.get(
    "/{resume_id}/preview",
    response_model=ResumePreviewResponse,
    summary="Get resume preview URL",
)
def preview_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> ResumePreviewResponse:
    return resume_service.preview(db, resume_id)


@router.get(
    "/{resume_id}/download",
    summary="Download resume (redirects to Cloudinary)",
    response_class=RedirectResponse,
)
def download_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> RedirectResponse:
    url, _filename = resume_service.get_download_url(db, resume_id)
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.delete(
    "/{resume_id}",
    response_model=MessageResponse,
    summary="Delete resume",
)
def delete_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
) -> MessageResponse:
    resume_service.delete(db, resume_id)
    return MessageResponse(message="Resume deleted successfully")

"""Resume upload, list, preview, and download endpoints."""

from __future__ import annotations

import mimetypes
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.api.deps import CandidateUser, DBSession, RecruiterUser
from app.schemas.common import MessageResponse
from app.schemas.resume import ResumeListResponse, ResumePreviewResponse, ResumeResponse
from app.services.candidate import candidate_service
from app.services.resume import resume_service

router = APIRouter(prefix="/resumes", tags=["resumes"])

_ACCEPT = "PDF, DOC, DOCX, TXT, or RTF"


def _download_response(
    kind: str, url_or_name: str, local_path, *, inline: bool = False
) -> Response:
    if kind == "file" and local_path is not None:
        media_type, _ = mimetypes.guess_type(url_or_name)
        return FileResponse(
            path=local_path,
            filename=url_or_name,
            media_type=media_type or "application/octet-stream",
            content_disposition_type="inline" if inline else "attachment",
        )
    return RedirectResponse(url=url_or_name, status_code=status.HTTP_302_FOUND)


@router.post(
    "/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary=f"Upload or replace resume ({_ACCEPT}) — stores file only, no profile changes",
)
async def upload_resume(
    db: DBSession,
    _: RecruiterUser,
    candidate_id: Annotated[uuid.UUID, Form(...)],
    file: Annotated[UploadFile, File(..., description=_ACCEPT)],
    is_primary: Annotated[bool, Form()] = True,
    replace_existing: Annotated[bool, Form()] = True,
) -> ResumeResponse:
    return await resume_service.upload(
        db,
        candidate_id=candidate_id,
        file=file,
        is_primary=is_primary,
        replace_existing=replace_existing,
    )


@router.post(
    "/me/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary=f"Candidate upload or replace own resume ({_ACCEPT}) — stores file only",
)
async def upload_my_resume(
    db: DBSession,
    current_user: CandidateUser,
    file: Annotated[UploadFile, File(..., description=_ACCEPT)],
    is_primary: Annotated[bool, Form()] = True,
    replace_existing: Annotated[bool, Form()] = True,
) -> ResumeResponse:
    me = candidate_service.get_by_user_id(db, current_user.id)
    return await resume_service.upload(
        db,
        candidate_id=me.id,
        file=file,
        is_primary=is_primary,
        replace_existing=replace_existing,
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
    "/me/{resume_id}",
    response_model=ResumeResponse,
    summary="Get own resume metadata",
)
def get_my_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
) -> ResumeResponse:
    return resume_service.get_mine(db, resume_id=resume_id, user=current_user)


@router.get(
    "/me/{resume_id}/preview",
    response_model=ResumePreviewResponse,
    summary="Preview own resume",
)
def preview_my_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
) -> ResumePreviewResponse:
    return resume_service.preview_mine(db, resume_id=resume_id, user=current_user)


@router.get(
    "/me/{resume_id}/download",
    summary="Download own resume",
    response_model=None,
)
def download_my_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
    inline: Annotated[bool, Query()] = False,
) -> Response:
    kind, url_or_name, local_path = resume_service.resolve_download_mine(
        db, resume_id=resume_id, user=current_user
    )
    return _download_response(kind, url_or_name, local_path, inline=inline)


@router.delete(
    "/me/{resume_id}",
    response_model=MessageResponse,
    summary="Delete own resume",
)
def delete_my_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    current_user: CandidateUser,
) -> MessageResponse:
    resume_service.delete_mine(db, resume_id=resume_id, user=current_user)
    return MessageResponse(message="Resume deleted successfully")


@router.get(
    "",
    response_model=ResumeListResponse,
    summary="List resumes",
)
def list_resumes(
    db: DBSession,
    _: RecruiterUser,
    candidate_id: uuid.UUID | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResumeListResponse:
    return resume_service.list(
        db,
        candidate_id=candidate_id,
        search=search,
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
    summary="Download resume",
    response_model=None,
)
def download_resume(
    resume_id: uuid.UUID,
    db: DBSession,
    _: RecruiterUser,
    inline: Annotated[bool, Query()] = False,
) -> Response:
    kind, url_or_name, local_path = resume_service.resolve_download(db, resume_id)
    return _download_response(kind, url_or_name, local_path, inline=inline)


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

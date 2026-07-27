"""Unified profile endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.api.deps import CurrentUser, DBSession
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.profile import profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    summary="Get current user profile",
)
def get_my_profile(db: DBSession, current_user: CurrentUser) -> ProfileResponse:
    return profile_service.get_me(db, current_user)


@router.patch(
    "/me",
    response_model=ProfileResponse,
    summary="Update current user profile",
)
def update_my_profile(
    payload: ProfileUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> ProfileResponse:
    return profile_service.update_me(db, current_user, data=payload)


@router.post(
    "/me/avatar",
    response_model=ProfileResponse,
    summary="Upload profile picture",
)
async def upload_my_avatar(
    db: DBSession,
    current_user: CurrentUser,
    file: Annotated[UploadFile, File(..., description="Profile image")],
) -> ProfileResponse:
    return await profile_service.upload_avatar(db, current_user, file=file)

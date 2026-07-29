"""Account settings endpoints (language + privacy)."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DBSession
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate
from app.services.settings import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get(
    "/me",
    response_model=UserSettingsResponse,
    summary="Get language and privacy settings",
)
def get_my_settings(db: DBSession, current_user: CurrentUser) -> UserSettingsResponse:
    return settings_service.get_me(db, current_user)


@router.patch(
    "/me",
    response_model=UserSettingsResponse,
    summary="Update language and privacy settings",
)
def update_my_settings(
    payload: UserSettingsUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    return settings_service.update_me(db, current_user, data=payload)

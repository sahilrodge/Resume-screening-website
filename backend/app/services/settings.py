"""User settings and account deletion business logic."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException, UnauthorizedError
from app.core.security import verify_password
from app.core.super_admin import protect_super_admin
from app.crud.refresh_token import refresh_token as refresh_token_crud
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate


def _get_or_create(db: Session, user_id: uuid.UUID) -> UserSettings:
    existing = db.scalars(
        select(UserSettings).where(UserSettings.user_id == user_id)
    ).first()
    if existing is not None:
        return existing
    settings = UserSettings(user_id=user_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def ensure_ai_allowed(db: Session, user: User | None) -> None:
    """Raise if the user has disabled AI processing in privacy settings."""
    if user is None:
        return
    prefs = _get_or_create(db, user.id)
    if not prefs.allow_ai_processing:
        raise AppException(
            "AI features are disabled in your privacy settings. "
            "Enable “Allow AI processing” in Settings to use resume screening "
            "and assistant features.",
            status_code=403,
            code="ai_processing_disabled",
        )


class SettingsService:
    def get_me(self, db: Session, user: User) -> UserSettingsResponse:
        settings = _get_or_create(db, user.id)
        return UserSettingsResponse.model_validate(settings)

    def update_me(
        self, db: Session, user: User, *, data: UserSettingsUpdate
    ) -> UserSettingsResponse:
        settings = _get_or_create(db, user.id)
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(settings, key, value)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return UserSettingsResponse.model_validate(settings)

    def delete_account(self, db: Session, user: User, *, password: str) -> None:
        protect_super_admin(user, action="deleted")
        if not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Password is incorrect")
        refresh_token_crud.revoke_all_for_user(db, user_id=user.id)
        db.delete(user)
        db.commit()


settings_service = SettingsService()

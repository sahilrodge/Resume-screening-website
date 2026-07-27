"""Authentication business logic."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    verify_password,
    verify_token,
)
from app.crud.candidate import candidate as candidate_crud
from app.crud.refresh_token import refresh_token as refresh_token_crud
from app.crud.user import user as user_crud
from app.models.candidate import Candidate
from app.models.enums import UserRole
from app.models.recruiter import Recruiter
from app.models.user import User
from app.schemas.auth import AuthResponse, TokenResponse
from app.schemas.user import UserCreate, UserLogin, UserResponse


class AuthService:
    def register(self, db: Session, *, data: UserCreate) -> AuthResponse:
        if user_crud.get_by_email(db, data.email):
            raise ConflictError("Email already registered")

        # Public self-registration is candidate-only; staff via admin invite
        if data.role != UserRole.CANDIDATE:
            raise ForbiddenError(
                "Public registration is limited to candidate accounts. "
                "Ask an administrator to invite staff users."
            )

        user = user_crud.create(db, obj_in=data)
        self._ensure_role_profile(db, user)
        tokens = self._issue_tokens(db, user, remember_me=False)
        return AuthResponse(user=UserResponse.model_validate(user), tokens=tokens)

    def _ensure_role_profile(self, db: Session, user: User) -> None:
        """Create the linked Candidate/Recruiter row for the user role."""
        if user.role == UserRole.CANDIDATE:
            if candidate_crud.get_by_user_id(db, user.id) is None:
                db.add(Candidate(user_id=user.id))
                db.commit()
            return
        if user.role == UserRole.RECRUITER:
            from sqlalchemy import select

            existing = db.scalars(
                select(Recruiter).where(Recruiter.user_id == user.id)
            ).first()
            if existing is None:
                db.add(Recruiter(user_id=user.id, company_id=None))
                db.commit()

    def login(self, db: Session, *, data: UserLogin) -> AuthResponse:
        user = user_crud.get_by_email(db, data.email)
        if user is None or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedError("Incorrect email or password")
        if not user.is_active:
            raise ForbiddenError("User account is inactive")

        tokens = self._issue_tokens(db, user, remember_me=data.remember_me)
        return AuthResponse(user=UserResponse.model_validate(user), tokens=tokens)

    def refresh(
        self,
        db: Session,
        *,
        refresh_token: str,
        remember_me: bool | None = None,
    ) -> TokenResponse:
        payload = verify_token(refresh_token, expected_type="refresh")
        if payload is None:
            raise UnauthorizedError("Invalid refresh token")

        jti = payload.get("jti")
        if not jti:
            raise UnauthorizedError("Invalid refresh token")

        stored = refresh_token_crud.get_by_jti(db, jti)
        if stored is None:
            raise UnauthorizedError("Invalid refresh token")

        # Reuse detection: a previously rotated/revoked token → kill all sessions
        if stored.revoked:
            refresh_token_crud.revoke_all_for_user(db, stored.user_id)
            raise UnauthorizedError("Refresh token reuse detected")

        if refresh_token_crud.is_expired(stored):
            stored.revoked = True
            db.add(stored)
            db.commit()
            raise UnauthorizedError("Refresh token is expired")

        if stored.token_hash != hash_token(refresh_token):
            refresh_token_crud.revoke_all_for_user(db, stored.user_id)
            raise UnauthorizedError("Invalid refresh token")

        user = user_crud.get_by_id(db, stored.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        persist = (
            remember_me
            if remember_me is not None
            else bool(payload.get("remember_me", False))
        )

        refresh_token_crud.revoke_by_jti(db, jti)
        return self._issue_tokens(db, user, remember_me=persist)

    def logout(self, db: Session, *, refresh_token: str) -> None:
        """Revoke only the presented refresh token (this device)."""
        payload = verify_token(refresh_token, expected_type="refresh")
        if payload is None:
            return
        jti = payload.get("jti")
        if jti:
            refresh_token_crud.revoke_by_jti(db, jti)

    def _issue_tokens(
        self,
        db: Session,
        user: User,
        *,
        remember_me: bool,
    ) -> TokenResponse:
        refresh_days = (
            settings.REFRESH_TOKEN_REMEMBER_DAYS
            if remember_me
            else settings.REFRESH_TOKEN_SESSION_DAYS
        )
        access_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        extra = {
            "role": user.role.value,
            "email": user.email,
            "full_name": user.full_name,
            "remember_me": remember_me,
        }
        access = create_access_token(
            str(user.id),
            expires_delta=timedelta(minutes=access_minutes),
            extra_claims=extra,
        )
        refresh, jti, expires_at = create_refresh_token(
            str(user.id),
            expires_delta=timedelta(days=refresh_days),
            extra_claims=extra,
        )

        refresh_token_crud.create(
            db,
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh),
            expires_at=expires_at,
        )

        now = datetime.now(UTC)
        refresh_seconds = max(0, int((expires_at - now).total_seconds()))
        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=access_minutes * 60,
            refresh_expires_in=refresh_seconds,
            remember_me=remember_me,
        )


auth_service = AuthService()


def parse_user_id(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except (ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid token subject") from exc

"""Authentication business logic."""

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_token,
    verify_password,
    verify_token,
)
from app.crud.refresh_token import refresh_token as refresh_token_crud
from app.crud.user import user as user_crud
from app.models.user import User
from app.schemas.auth import AuthResponse, TokenResponse
from app.schemas.user import UserCreate, UserLogin, UserResponse


class AuthService:
    def register(self, db: Session, *, data: UserCreate) -> AuthResponse:
        if user_crud.get_by_email(db, data.email):
            raise ConflictError("Email already registered")

        user = user_crud.create(db, obj_in=data)
        tokens = self._issue_tokens(db, user)
        return AuthResponse(user=UserResponse.model_validate(user), tokens=tokens)

    def login(self, db: Session, *, data: UserLogin) -> AuthResponse:
        user = user_crud.get_by_email(db, data.email)
        if user is None or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedError("Incorrect email or password")
        if not user.is_active:
            raise ForbiddenError("User account is inactive")

        tokens = self._issue_tokens(db, user)
        return AuthResponse(user=UserResponse.model_validate(user), tokens=tokens)

    def refresh(self, db: Session, *, refresh_token: str) -> TokenResponse:
        payload = verify_token(refresh_token, expected_type="refresh")
        if payload is None:
            raise UnauthorizedError("Invalid refresh token")

        jti = payload.get("jti")
        if not jti:
            raise UnauthorizedError("Invalid refresh token")

        stored = refresh_token_crud.get_active_by_jti(db, jti)
        if stored is None or refresh_token_crud.is_expired(stored):
            raise UnauthorizedError("Refresh token is revoked or expired")

        if stored.token_hash != hash_token(refresh_token):
            raise UnauthorizedError("Invalid refresh token")

        user = user_crud.get_by_id(db, stored.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("User not found or inactive")

        # Rotate: revoke old refresh token, issue new pair
        refresh_token_crud.revoke_by_jti(db, jti)
        return self._issue_tokens(db, user)

    def logout(self, db: Session, *, refresh_token: str) -> None:
        payload = verify_token(refresh_token, expected_type="refresh")
        if payload is None:
            # Idempotent logout — treat invalid token as already logged out
            return
        jti = payload.get("jti")
        if jti:
            refresh_token_crud.revoke_by_jti(db, jti)

    def _issue_tokens(self, db: Session, user: User) -> TokenResponse:
        extra = {"role": user.role.value}
        access = create_access_token(str(user.id), extra_claims=extra)
        refresh, jti, expires_at = create_refresh_token(str(user.id), extra_claims=extra)

        refresh_token_crud.create(
            db,
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh),
            expires_at=expires_at,
        )
        return TokenResponse(access_token=access, refresh_token=refresh)


auth_service = AuthService()


def parse_user_id(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except (ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid token subject") from exc

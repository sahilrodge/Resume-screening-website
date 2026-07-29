"""Authentication endpoints: register, login, refresh, me, logout."""

from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import enforce_auth_rate_limit
from app.core.security import verify_password
from app.crud.user import user as user_crud
from app.schemas.auth import (
    AuthResponse,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.settings import DeleteAccountRequest
from app.schemas.user import UserLogin, UserResponse, UserUpdateMe
from app.services.auth import auth_service
from app.services.settings import settings_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a candidate account (public)",
)
def register(payload: RegisterRequest, db: DBSession, request: Request) -> AuthResponse:
    """Create a candidate account. Recruiter/Admin signup is not allowed publicly."""
    enforce_auth_rate_limit(
        request,
        action="register",
        identity=str(payload.email),
        limit=5,
        window_seconds=60,
    )
    return auth_service.register(db, data=payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login",
)
def login(payload: UserLogin, db: DBSession, request: Request) -> AuthResponse:
    """Authenticate with email/password and return JWT tokens."""
    enforce_auth_rate_limit(
        request,
        action="login",
        identity=str(payload.email),
        limit=10,
        window_seconds=60,
    )
    return auth_service.login(db, data=payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
def refresh(payload: RefreshRequest, db: DBSession, request: Request) -> TokenResponse:
    """Rotate refresh token and issue a new access/refresh pair."""
    enforce_auth_rate_limit(
        request,
        action="refresh",
        limit=30,
        window_seconds=60,
    )
    return auth_service.refresh(
        db,
        refresh_token=payload.refresh_token,
        remember_me=payload.remember_me,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current user",
)
def me(current_user: CurrentUser) -> UserResponse:
    """Return the authenticated user from the access token."""
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
)
def update_me(
    payload: UserUpdateMe,
    db: DBSession,
    current_user: CurrentUser,
) -> UserResponse:
    """Update full name and/or password for the authenticated user."""
    if payload.new_password:
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.hashed_password
        ):
            raise UnauthorizedError("Current password is incorrect")
    updated = user_crud.update(
        db,
        db_obj=current_user,
        full_name=payload.full_name,
        password=payload.new_password,
    )
    return UserResponse.model_validate(updated)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout",
)
def logout(payload: LogoutRequest, db: DBSession) -> MessageResponse:
    """Revoke the presented refresh token for this device/session."""
    auth_service.logout(db, refresh_token=payload.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Logout all devices",
)
def logout_all(db: DBSession, current_user: CurrentUser) -> MessageResponse:
    """Revoke every refresh token for the authenticated user."""
    auth_service.logout_all(db, user_id=current_user.id)
    return MessageResponse(message="Logged out from all devices")


@router.delete(
    "/me",
    response_model=MessageResponse,
    summary="Delete my account",
)
def delete_me(
    payload: DeleteAccountRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> MessageResponse:
    """Permanently delete the authenticated account after password confirmation."""
    settings_service.delete_account(
        db, current_user, password=payload.password
    )
    return MessageResponse(message="Account deleted successfully")

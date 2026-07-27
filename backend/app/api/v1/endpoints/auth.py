"""Authentication endpoints: register, login, refresh, me, logout."""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.auth import AuthResponse, LogoutRequest, RefreshRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(payload: UserCreate, db: DBSession) -> AuthResponse:
    """Create a user (role: admin | recruiter | candidate) and return JWT tokens."""
    return auth_service.register(db, data=payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login",
)
def login(payload: UserLogin, db: DBSession) -> AuthResponse:
    """Authenticate with email/password and return JWT tokens."""
    return auth_service.login(db, data=payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
def refresh(payload: RefreshRequest, db: DBSession) -> TokenResponse:
    """Rotate refresh token and issue a new access/refresh pair."""
    return auth_service.refresh(db, refresh_token=payload.refresh_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current user",
)
def me(current_user: CurrentUser) -> UserResponse:
    """Return the authenticated user from the access token."""
    return UserResponse.model_validate(current_user)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout",
)
def logout(payload: LogoutRequest, db: DBSession) -> MessageResponse:
    """Revoke the provided refresh token."""
    auth_service.logout(db, refresh_token=payload.refresh_token)
    return MessageResponse(message="Logged out successfully")

"""Shared FastAPI dependencies."""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import verify_token
from app.crud.user import user as user_crud
from app.database.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.auth import parse_user_id

DBSession = Annotated[Session, Depends(get_db)]

reusable_oauth2 = HTTPBearer(auto_error=False)


def get_token_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(reusable_oauth2),
    ],
) -> dict[str, Any]:
    """Validate Bearer access JWT and return the decoded payload."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Missing or invalid Authorization header")

    payload = verify_token(credentials.credentials, expected_type="access")
    if payload is None:
        raise UnauthorizedError("Could not validate credentials")
    return payload


TokenPayloadDep = Annotated[dict[str, Any], Depends(get_token_payload)]


def get_current_user(
    db: DBSession,
    payload: TokenPayloadDep,
) -> User:
    """Resolve the authenticated user from the access token."""
    user_id = parse_user_id(str(payload["sub"]))
    user = user_crud.get_by_id(db, user_id)
    if user is None:
        raise UnauthorizedError("User not found")
    if not user.is_active:
        raise ForbiddenError("User account is inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Dependency factory that enforces one of the allowed roles."""

    def _checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise ForbiddenError("Insufficient permissions")
        return current_user

    return _checker


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
RecruiterUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN, UserRole.RECRUITER)),
]
CandidateUser = Annotated[User, Depends(require_roles(UserRole.CANDIDATE))]

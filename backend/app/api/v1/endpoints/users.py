"""Admin user management endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import func, select

from app.api.deps import AdminUser, DBSession
from app.core.exceptions import ConflictError, NotFoundError
from app.crud.user import user as user_crud
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AdminUserCreate, AdminUserUpdate, UserCreate
from app.services.auth import auth_service

router = APIRouter(prefix="/users", tags=["users"])


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int
    pages: int


@router.get(
    "",
    response_model=AdminUserListResponse,
    summary="List all users (admin only)",
)
def list_users(
    db: DBSession,
    _: AdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    role: UserRole | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
) -> AdminUserListResponse:
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if search:
        term = f"%{search.strip().lower()}%"
        filters.append(
            (func.lower(User.full_name).like(term)) | (func.lower(User.email).like(term))
        )

    count_stmt = select(func.count()).select_from(User)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = db.scalar(count_stmt) or 0

    stmt = select(User).order_by(User.created_at.desc())
    if filters:
        stmt = stmt.where(*filters)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    pages = max(1, (total + page_size - 1) // page_size) if total else 0

    return AdminUserListResponse(
        items=[AdminUserResponse.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite / create a user (admin only)",
)
def create_user(
    payload: AdminUserCreate,
    db: DBSession,
    _: AdminUser,
) -> AdminUserResponse:
    if user_crud.get_by_email(db, payload.email):
        raise ConflictError("Email already registered")
    user = user_crud.create(
        db,
        obj_in=UserCreate(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
        ),
    )
    auth_service._ensure_role_profile(db, user)
    return AdminUserResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=AdminUserResponse,
    summary="Update user role or active status (admin only)",
)
def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    db: DBSession,
    current_admin: AdminUser,
) -> AdminUserResponse:
    user = user_crud.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    # Prevent accidental self-lockout
    if user.id == current_admin.id and payload.is_active is False:
        raise ConflictError("Cannot deactivate your own account")
    updated = user_crud.update(
        db,
        db_obj=user,
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
    )
    return AdminUserResponse.model_validate(updated)

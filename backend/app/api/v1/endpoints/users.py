"""Admin user management endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.api.deps import AdminUser, DBSession
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.super_admin import is_super_admin, protect_super_admin
from app.crud.company import company as company_crud
from app.crud.refresh_token import refresh_token as refresh_token_crud
from app.crud.user import user as user_crud
from app.models.company import Company
from app.models.enums import UserRole
from app.models.recruiter import Recruiter
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.company import CompanyCreate
from app.schemas.user import AdminResetPassword, AdminUserCreate, AdminUserUpdate, UserCreate
from app.services.auth import auth_service

router = APIRouter(prefix="/users", tags=["users"])


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    is_super_admin: bool = False
    company_name: str | None = None
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int
    pages: int


def _company_name(user: User) -> str | None:
    recruiter = getattr(user, "recruiter_profile", None)
    if recruiter is None:
        return None
    company = getattr(recruiter, "company", None)
    if company is None:
        return None
    return company.name


def _to_admin_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_super_admin=is_super_admin(user),
        company_name=_company_name(user),
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _user_with_company(db, user_id: uuid.UUID) -> User | None:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            joinedload(User.recruiter_profile).joinedload(Recruiter.company),
        )
    )
    return db.scalars(stmt).first()


def _sync_recruiter_company(
    db, *, user: User, company_name: str | None
) -> None:
    if user.role != UserRole.RECRUITER:
        return
    recruiter = user.recruiter_profile
    if recruiter is None:
        auth_service._ensure_role_profile(db, user)
        user = _user_with_company(db, user.id) or user
        recruiter = user.recruiter_profile
    if recruiter is None:
        return

    name = (company_name or "").strip()
    if not name:
        recruiter.company_id = None
    else:
        existing = company_crud.get_by_name(db, name)
        if existing is None:
            existing = company_crud.create(db, obj_in=CompanyCreate(name=name))
        recruiter.company_id = existing.id
    db.add(recruiter)
    db.commit()


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
    is_active: bool | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[
        Literal["all", "active", "suspended"] | None, Query(alias="status")
    ] = None,
) -> AdminUserListResponse:
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))
    elif status_filter == "active":
        filters.append(User.is_active.is_(True))
    elif status_filter == "suspended":
        filters.append(User.is_active.is_(False))
    if search:
        term = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                User.id.in_(
                    select(Recruiter.user_id)
                    .join(Company, Recruiter.company_id == Company.id)
                    .where(func.lower(Company.name).like(term))
                ),
            )
        )

    count_stmt = select(func.count()).select_from(User)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(User)
        .options(joinedload(User.recruiter_profile).joinedload(Recruiter.company))
        .order_by(User.created_at.desc())
    )
    if filters:
        stmt = stmt.where(*filters)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).unique().all())
    pages = max(1, (total + page_size - 1) // page_size) if total else 0

    return AdminUserListResponse(
        items=[_to_admin_user(u) for u in items],
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
    if payload.role not in {UserRole.ADMIN, UserRole.RECRUITER}:
        raise ForbiddenError("Admins can only create Recruiter or Admin accounts")
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
    if payload.role == UserRole.RECRUITER and payload.company_name:
        _sync_recruiter_company(db, user=user, company_name=payload.company_name)
    refreshed = _user_with_company(db, user.id) or user
    return _to_admin_user(refreshed)


@router.get(
    "/{user_id}",
    response_model=AdminUserResponse,
    summary="Get user detail (admin only)",
)
def get_user(
    user_id: uuid.UUID,
    db: DBSession,
    _: AdminUser,
) -> AdminUserResponse:
    user = _user_with_company(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return _to_admin_user(user)


@router.patch(
    "/{user_id}",
    response_model=AdminUserResponse,
    summary="Update user (admin only)",
)
def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    db: DBSession,
    current_admin: AdminUser,
) -> AdminUserResponse:
    user = _user_with_company(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    if user.id == current_admin.id and payload.is_active is False:
        raise ConflictError("Cannot suspend your own account")
    if is_super_admin(user):
        if payload.is_active is False:
            protect_super_admin(user, action="suspended")
        if payload.role is not None and payload.role != UserRole.ADMIN:
            protect_super_admin(user, action="demoted")
        if payload.email is not None and str(payload.email).lower() != user.email.lower():
            protect_super_admin(user, action="reassigned (email change)")
    if payload.role is not None:
        if payload.role == UserRole.CANDIDATE and user.role != UserRole.CANDIDATE:
            raise ForbiddenError(
                "Cannot assign the Candidate role via admin user management"
            )
        if payload.role not in {
            UserRole.ADMIN,
            UserRole.RECRUITER,
            UserRole.CANDIDATE,
        }:
            raise ForbiddenError("Insufficient permissions")
    if payload.email and payload.email.lower() != user.email.lower():
        existing = user_crud.get_by_email(db, payload.email)
        if existing and existing.id != user.id:
            raise ConflictError("Email already registered")

    previous_role = user.role
    updated = user_crud.update(
        db,
        db_obj=user,
        full_name=payload.full_name,
        email=str(payload.email) if payload.email is not None else None,
        role=payload.role,
        is_active=payload.is_active,
    )
    if payload.role is not None and payload.role != previous_role:
        auth_service._ensure_role_profile(db, updated)

    if payload.company_name is not None or (
        payload.role == UserRole.RECRUITER and payload.company_name
    ):
        _sync_recruiter_company(
            db, user=updated, company_name=payload.company_name
        )

    if payload.is_active is False:
        refresh_token_crud.revoke_all_for_user(db, updated.id)

    refreshed = _user_with_company(db, updated.id) or updated
    return _to_admin_user(refreshed)


@router.post(
    "/{user_id}/suspend",
    response_model=AdminUserResponse,
    summary="Suspend user (admin only)",
)
def suspend_user(
    user_id: uuid.UUID,
    db: DBSession,
    current_admin: AdminUser,
) -> AdminUserResponse:
    return update_user(
        user_id,
        AdminUserUpdate(is_active=False),
        db,
        current_admin,
    )


@router.post(
    "/{user_id}/activate",
    response_model=AdminUserResponse,
    summary="Activate user (admin only)",
)
def activate_user(
    user_id: uuid.UUID,
    db: DBSession,
    current_admin: AdminUser,
) -> AdminUserResponse:
    return update_user(
        user_id,
        AdminUserUpdate(is_active=True),
        db,
        current_admin,
    )


@router.post(
    "/{user_id}/reset-password",
    response_model=MessageResponse,
    summary="Reset user password (admin only)",
)
def reset_password(
    user_id: uuid.UUID,
    payload: AdminResetPassword,
    db: DBSession,
    current_admin: AdminUser,
) -> MessageResponse:
    user = user_crud.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    # Other admins cannot reset the Super Admin password; Super Admin may self-reset.
    if is_super_admin(user) and current_admin.id != user.id:
        protect_super_admin(user, action="password-reset by another admin")
    user_crud.update(db, db_obj=user, password=payload.new_password)
    refresh_token_crud.revoke_all_for_user(db, user.id)
    return MessageResponse(
        message="Password reset successfully. The user must sign in with the new password."
    )


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    summary="Delete user (admin only)",
)
def delete_user(
    user_id: uuid.UUID,
    db: DBSession,
    current_admin: AdminUser,
) -> MessageResponse:
    user = user_crud.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    protect_super_admin(user, action="deleted")
    if user.id == current_admin.id:
        raise ConflictError("Cannot delete your own account")
    refresh_token_crud.revoke_all_for_user(db, user.id)
    user_crud.delete(db, db_obj=user)
    return MessageResponse(message="User deleted successfully")

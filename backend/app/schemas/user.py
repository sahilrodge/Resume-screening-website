"""User request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.passwords import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validate_password_strength,
)
from app.models.enums import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.CANDIDATE

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return validate_password_strength(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    remember_me: bool = False


class UserUpdateMe(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    current_password: str | None = None
    new_password: str | None = Field(
        default=None, min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )

    @field_validator("new_password")
    @classmethod
    def _new_password_strength(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return validate_password_strength(value)


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.RECRUITER
    company_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("role")
    @classmethod
    def _staff_roles_only(cls, value: UserRole) -> UserRole:
        if value not in {UserRole.ADMIN, UserRole.RECRUITER}:
            raise ValueError("Admins can only create Recruiter or Admin accounts")
        return value


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    company_name: str | None = Field(default=None, max_length=255)

    @field_validator("role")
    @classmethod
    def _allowed_roles(cls, value: UserRole | None) -> UserRole | None:
        if value is None:
            return value
        if value not in {UserRole.ADMIN, UserRole.RECRUITER, UserRole.CANDIDATE}:
            raise ValueError("Invalid role")
        return value


class AdminResetPassword(BaseModel):
    new_password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return validate_password_strength(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime

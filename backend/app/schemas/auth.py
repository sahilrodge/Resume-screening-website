"""Authentication request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.core.passwords import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validate_password_strength,
)
from app.schemas.user import UserResponse


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    refresh_expires_in: int = Field(description="Refresh token lifetime in seconds")
    remember_me: bool = False


class EmailVerificationPlaceholder(BaseModel):
    """Email verification status. SMTP confirmation is not enabled yet."""

    status: Literal["pending"] = "pending"
    required: bool = False
    message: str = (
        "Email confirmation is optional for now. "
        "SMTP verification can be enabled in a future release."
    )


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse
    email_verification: EmailVerificationPlaceholder = Field(
        default_factory=EmailVerificationPlaceholder
    )


class RegisterRequest(BaseModel):
    """Public candidate registration only. Staff accounts are created by admins."""

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    full_name: str = Field(min_length=1, max_length=255)
    confirm_password: str | None = Field(default=None, max_length=PASSWORD_MAX_LENGTH)
    company_name: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)  # ignored for public signup
    phone: str | None = Field(default=None, max_length=30)
    remember_me: bool = False

    @model_validator(mode="after")
    def validate_registration(self) -> RegisterRequest:
        validate_password_strength(self.password)

        if (
            self.confirm_password is not None
            and self.confirm_password != ""
            and self.confirm_password != self.password
        ):
            raise ValueError("Passwords do not match")

        return self


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)
    remember_me: bool | None = None


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)

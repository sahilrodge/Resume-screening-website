"""Authentication request/response schemas."""

from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    refresh_expires_in: int = Field(description="Refresh token lifetime in seconds")
    remember_me: bool = False


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)
    remember_me: bool | None = None


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)

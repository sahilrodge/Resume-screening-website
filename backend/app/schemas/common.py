"""Shared response schemas (infrastructure only)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str


class HealthResponse(BaseModel):
    """Liveness / readiness response."""

    status: str = "ok"
    app: str
    version: str
    environment: str
    storage_backend: str | None = None
    cloudinary_configured: bool | None = None
    storage_message: str | None = None


class ReadyResponse(BaseModel):
    """Readiness probe including database status."""

    status: str
    app: str
    version: str
    environment: str
    database: str
    storage_backend: str | None = None
    cloudinary_configured: bool | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
    request_id: str | None = None


class ORMBaseModel(BaseModel):
    """Base schema with ORM mode enabled for future models."""

    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    """Common pagination query parameters."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

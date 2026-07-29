"""Company request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.job import JobResponse


class CompanySocialLinks(BaseModel):
    linkedin: str | None = None
    twitter: str | None = None
    facebook: str | None = None
    instagram: str | None = None
    youtube: str | None = None
    github: str | None = None


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    employee_count: str | None = Field(default=None, max_length=60)
    culture: str | None = None
    benefits: list[str] | None = None
    social_links: dict[str, str | None] | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("benefits")
    @classmethod
    def clean_benefits(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [item.strip() for item in value if item and item.strip()]
        return cleaned or []


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    employee_count: str | None = Field(default=None, max_length=60)
    culture: str | None = None
    benefits: list[str] | None = None
    social_links: dict[str, str | None] | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    website: str | None = None
    industry: str | None = None
    location: str | None = None
    logo_url: str | None = None
    employee_count: str | None = None
    culture: str | None = None
    benefits: list[str] = Field(default_factory=list)
    social_links: dict[str, Any] = Field(default_factory=dict)
    open_jobs_count: int = 0
    created_at: datetime
    updated_at: datetime


class CompanyProfileResponse(CompanyResponse):
    open_jobs: list[JobResponse] = Field(default_factory=list)


class CompanyListResponse(BaseModel):
    items: list[CompanyResponse]
    total: int

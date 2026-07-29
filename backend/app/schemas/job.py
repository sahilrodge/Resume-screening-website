"""Job request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import EmploymentType, JobStatus


class JobCreate(BaseModel):
    company_id: uuid.UUID
    recruiter_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    location: str | None = Field(default=None, max_length=255)
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    status: JobStatus = JobStatus.DRAFT
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=10)
    experience_min_years: int | None = Field(default=None, ge=0, le=80)
    experience_max_years: int | None = Field(default=None, ge=0, le=80)
    openings: int = Field(default=1, ge=1, le=1000)
    closes_at: datetime | None = None
    skills: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned

    @model_validator(mode="after")
    def validate_ranges(self) -> JobCreate:
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min cannot exceed salary_max")
        if (
            self.experience_min_years is not None
            and self.experience_max_years is not None
            and self.experience_min_years > self.experience_max_years
        ):
            raise ValueError("experience_min_years cannot exceed experience_max_years")
        return self


class JobUpdate(BaseModel):
    company_id: uuid.UUID | None = None
    recruiter_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    location: str | None = Field(default=None, max_length=255)
    employment_type: EmploymentType | None = None
    status: JobStatus | None = None
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=10)
    experience_min_years: int | None = Field(default=None, ge=0, le=80)
    experience_max_years: int | None = Field(default=None, ge=0, le=80)
    openings: int | None = Field(default=None, ge=1, le=1000)
    closes_at: datetime | None = None
    skills: list[str] | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    company_name: str | None = None
    company_logo_url: str | None = None
    recruiter_id: uuid.UUID | None = None
    recruiter_name: str | None = None
    title: str
    description: str
    location: str | None = None
    employment_type: EmploymentType
    status: JobStatus
    salary_min: float | None = None
    salary_max: float | None = None
    currency: str
    experience_min_years: int | None = None
    experience_max_years: int | None = None
    openings: int
    application_count: int = 0
    skills: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    closes_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    page_size: int
    pages: int


class JobDashboardStats(BaseModel):
    total_jobs: int
    open_jobs: int
    draft_jobs: int
    closed_jobs: int
    filled_jobs: int
    total_applications: int


JobSortField = Literal[
    "created_at",
    "title",
    "status",
    "location",
    "employment_type",
    "published_at",
    "application_count",
]
SortOrder = Literal["asc", "desc"]

"""Candidate request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.parsed_resume import EducationItem, ExperienceItem, ParsedResumeData


class CandidateCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    location: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    years_experience: int | None = Field(default=None, ge=0, le=80)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    current_title: str | None = Field(default=None, max_length=255)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("full_name cannot be empty")
        return cleaned


class CandidateUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    location: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    years_experience: int | None = Field(default=None, ge=0, le=80)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    current_title: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    skills: list[str] | None = None
    education: list[EducationItem] | None = None
    experience: list[ExperienceItem] | None = None

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("full_name cannot be empty")
        return cleaned


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    phone: str | None = None
    location: str | None = None
    headline: str | None = None
    summary: str | None = None
    years_experience: int | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    current_title: str | None = None
    created_at: datetime
    updated_at: datetime


class CandidateProfileResponse(CandidateResponse):
    """Candidate detail including latest OpenAI-parsed resume fields."""

    skills: list[str] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    resume_id: uuid.UUID | None = None
    resume_status: str | None = None
    parsed_data: ParsedResumeData | None = None


class CandidateListResponse(BaseModel):
    items: list[CandidateResponse]
    total: int
    page: int
    page_size: int
    pages: int


CandidateSortField = Literal[
    "created_at",
    "full_name",
    "email",
    "years_experience",
    "location",
    "current_title",
]
SortOrder = Literal["asc", "desc"]

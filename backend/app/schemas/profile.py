"""Unified profile schemas for candidate / recruiter / admin."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import UserRole
from app.schemas.parsed_resume import EducationItem, ExperienceItem


class ProfilePasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    """Role-aware profile update. Unused fields for a role are ignored."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    location: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    years_experience: int | None = Field(default=None, ge=0, le=80)
    current_title: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    skills: list[str] | None = None
    education: list[EducationItem] | None = None
    experience: list[ExperienceItem] | None = None
    # Recruiter
    company_name: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=120)
    # Password (optional combined save)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("full_name", "company_name")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("cannot be empty")
        return cleaned

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            name = item.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(name[:120])
        return cleaned

    @field_validator(
        "linkedin_url",
        "github_url",
        "portfolio_url",
        mode="before",
    )
    @classmethod
    def empty_url_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def password_pair(self) -> ProfileUpdate:
        if self.new_password and not self.current_password:
            raise ValueError("current_password is required to set a new password")
        return self


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    avatar_url: str | None = None
    phone: str | None = None
    # Candidate
    location: str | None = None
    headline: str | None = None
    summary: str | None = None
    years_experience: int | None = None
    current_title: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    skills: list[str] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    resume_id: uuid.UUID | None = None
    resume_file_name: str | None = None
    resume_status: str | None = None
    # Recruiter
    company_id: uuid.UUID | None = None
    company_name: str | None = None
    job_title: str | None = None
    department: str | None = None
    created_at: datetime
    updated_at: datetime

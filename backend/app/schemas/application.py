"""Application / match API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ApplicationStatus


class ApplicationCompareRequest(BaseModel):
    job_id: uuid.UUID
    resume_id: uuid.UUID


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    send_whatsapp: bool = True


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    job_title: str | None = None
    company_name: str | None = None
    candidate_id: uuid.UUID
    candidate_name: str | None = None
    candidate_email: str | None = None
    resume_id: uuid.UUID | None = None
    resume_file_name: str | None = None
    status: ApplicationStatus
    match_score: float | None = None
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    summary: str | None = None
    reasoning: str | None = None
    created_at: datetime
    updated_at: datetime


class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    total: int
    page: int
    page_size: int
    pages: int


ApplicationSortField = Literal["created_at", "match_score", "status"]
SortOrder = Literal["asc", "desc"]

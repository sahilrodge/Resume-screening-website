"""Resume schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ResumeStatus
from app.schemas.parsed_resume import ParsedResumeData


class AppliedJobSummary(BaseModel):
    application_id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    company_name: str | None = None
    ats_score: float | None = None
    match_score: float | None = None


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    candidate_email: str | None = None
    file_name: str
    file_url: str
    storage_path: str | None = None
    file_type: str | None = None
    status: ResumeStatus
    is_primary: bool
    parsed_data: ParsedResumeData | dict[str, Any] | None = None
    parse_error: str | None = None
    ats_score: float | None = None
    applied_jobs: list[AppliedJobSummary] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ResumeListResponse(BaseModel):
    items: list[ResumeResponse]
    total: int
    page: int = 1
    page_size: int = 20
    pages: int = 0


class ResumePreviewResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    preview_url: str
    download_url: str
    file_type: str | None = None


class ResumeUploadMeta(BaseModel):
    candidate_id: uuid.UUID
    is_primary: bool = False
    set_as_primary: bool = Field(
        default=False,
        description="Alias accepted from form fields",
    )

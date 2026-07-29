"""Saved job schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.job import JobResponse


class SavedJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    candidate_id: uuid.UUID
    created_at: datetime
    job: JobResponse | None = None


class SavedJobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    page_size: int
    pages: int


class SavedJobIdsResponse(BaseModel):
    job_ids: list[uuid.UUID]

"""Aggregate candidate sync payload — single source of truth for the portal."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.application import ApplicationResponse
from app.schemas.interview import InterviewResponse
from app.schemas.job import JobResponse
from app.schemas.notification import NotificationResponse
from app.schemas.profile import ProfileResponse
from app.schemas.resume import ResumeResponse


class CandidateOverviewResponse(BaseModel):
    """Latest candidate data from the database in one response."""

    profile: ProfileResponse
    resumes: list[ResumeResponse] = Field(default_factory=list)
    resumes_total: int = 0
    applications: list[ApplicationResponse] = Field(default_factory=list)
    applications_total: int = 0
    saved_jobs: list[JobResponse] = Field(default_factory=list)
    saved_jobs_total: int = 0
    saved_job_ids: list[str] = Field(default_factory=list)
    interviews: list[InterviewResponse] = Field(default_factory=list)
    interviews_total: int = 0
    notifications: list[NotificationResponse] = Field(default_factory=list)
    notifications_total: int = 0
    unread_notifications: int = 0

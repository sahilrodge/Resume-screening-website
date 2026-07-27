"""Analytics dashboard response schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class MonthPoint(BaseModel):
    month: str
    label: str
    applications: int = 0
    screened: int = 0


class FunnelStage(BaseModel):
    status: str
    label: str
    count: int


class HiringFunnel(BaseModel):
    stages: list[FunnelStage]
    rejected: int = 0
    withdrawn: int = 0


class JobPerformanceItem(BaseModel):
    job_id: uuid.UUID
    title: str
    status: str
    applications: int = 0
    avg_match_score: float | None = None
    interviews: int = 0
    hires: int = 0
    openings: int = 1
    fill_rate: float = 0.0


class RecruiterPerformanceItem(BaseModel):
    recruiter_id: uuid.UUID
    name: str
    jobs_owned: int = 0
    open_jobs: int = 0
    applications: int = 0
    interviews: int = 0
    hires: int = 0
    avg_match_score: float | None = None
    avg_time_to_hire_days: float | None = None


class MatchScoreBucket(BaseModel):
    range: str
    count: int


class MatchScoreMonth(BaseModel):
    month: str
    label: str
    avg_score: float
    count: int


class MatchScoreAnalytics(BaseModel):
    avg_score: float | None = None
    scored_applications: int = 0
    unscored_applications: int = 0
    buckets: list[MatchScoreBucket] = Field(default_factory=list)
    by_month: list[MatchScoreMonth] = Field(default_factory=list)


class StatusCount(BaseModel):
    status: str
    label: str
    count: int


class TypeCount(BaseModel):
    interview_type: str
    label: str
    count: int


class RatingBucket(BaseModel):
    rating: int
    count: int


class InterviewResults(BaseModel):
    by_status: list[StatusCount] = Field(default_factory=list)
    by_type: list[TypeCount] = Field(default_factory=list)
    avg_rating: float | None = None
    rated_count: int = 0
    rating_distribution: list[RatingBucket] = Field(default_factory=list)
    voice_completed: int = 0
    avg_voice_score: float | None = None
    avg_voice_duration_seconds: float | None = None


class MonthlyHiringPoint(BaseModel):
    month: str
    label: str
    applications: int = 0
    interviews: int = 0
    offers: int = 0
    hires: int = 0


class AnalyticsKpis(BaseModel):
    total_applications: int = 0
    total_hires: int = 0
    open_jobs: int = 0
    avg_match_score: float | None = None
    offer_accept_rate: float | None = None
    screen_to_interview_rate: float | None = None
    avg_time_to_hire_days: float | None = None


class AnalyticsOverview(BaseModel):
    kpis: AnalyticsKpis
    applications: list[MonthPoint]
    hiring_funnel: HiringFunnel
    job_performance: list[JobPerformanceItem]
    recruiter_performance: list[RecruiterPerformanceItem]
    match_scores: MatchScoreAnalytics
    interview_results: InterviewResults
    monthly_hiring: list[MonthlyHiringPoint]

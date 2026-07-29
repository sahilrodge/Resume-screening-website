"""Application / resume-job matching business logic."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.ai.job_matcher import compare_resume_to_job
from app.core.config import settings
from app.core.exceptions import AppException, ConflictError, NotFoundError
from app.crud.application import application as application_crud
from app.crud.job import job as job_crud
from app.crud.resume import resume as resume_crud
from app.models.application import Application
from app.models.enums import ApplicationStatus, JobStatus, NotificationType, ResumeStatus
from app.schemas.application import (
    ApplicationApplyRequest,
    ApplicationCompareRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationSortField,
    ApplicationStatusUpdate,
    SortOrder,
)
from app.services.notification import notification_service
from app.services.resume import resume_service


def _as_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(s).strip() for s in value if str(s).strip()]


def _to_response(obj: Application) -> ApplicationResponse:
    candidate_name = None
    candidate_email = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
        candidate_email = obj.candidate.user.email

    job_title = obj.job.title if obj.job else None
    company_name = obj.job.company.name if obj.job and obj.job.company else None
    resume_file_name = obj.resume.file_name if obj.resume else None

    return ApplicationResponse(
        id=obj.id,
        job_id=obj.job_id,
        job_title=job_title,
        company_name=company_name,
        candidate_id=obj.candidate_id,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        resume_id=obj.resume_id,
        resume_file_name=resume_file_name,
        status=obj.status,
        match_score=float(obj.match_score) if obj.match_score is not None else None,
        ats_score=float(obj.ats_score) if obj.ats_score is not None else None,
        matching_skills=_as_str_list(obj.matching_skills),
        missing_skills=_as_str_list(obj.missing_skills),
        strengths=_as_str_list(obj.strengths),
        weaknesses=_as_str_list(obj.weaknesses),
        suggestions=_as_str_list(obj.suggestions),
        summary=obj.ai_summary,
        reasoning=obj.reasoning,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def _resume_payload(resume) -> str:
    if resume.parsed_data:
        return json.dumps(resume.parsed_data, ensure_ascii=True, indent=2)
    if resume.raw_text:
        return resume.raw_text
    raise AppException(
        "Resume has no parsed data or text. Re-upload/parse the resume first.",
        status_code=400,
        code="resume_not_parsed",
    )


class ApplicationService:
    def compare(self, db: Session, *, data: ApplicationCompareRequest) -> ApplicationResponse:
        job = job_crud.get(db, data.job_id)
        if job is None:
            raise NotFoundError("Job not found")

        resume = resume_crud.get(db, data.resume_id)
        if resume is None:
            raise NotFoundError("Resume not found")

        # Auto re-extract / re-parse failed uploads before matching.
        resume = resume_service.ensure_ready(db, resume_id=resume.id)

        if (
            resume.status != ResumeStatus.PARSED
            and not resume.parsed_data
            and not resume.raw_text
        ):
            raise AppException(
                "Resume must be parsed before matching. Re-upload the resume and "
                "wait until status is Parsed.",
                status_code=400,
                code="resume_not_ready",
            )

        match = compare_resume_to_job(
            job_title=job.title,
            job_description=job.description,
            resume_payload=_resume_payload(resume),
        )

        existing = application_crud.get_by_job_candidate(
            db,
            job_id=job.id,
            candidate_id=resume.candidate_id,
        )
        is_new = existing is None
        if existing is None:
            existing = application_crud.create(
                db,
                job_id=job.id,
                candidate_id=resume.candidate_id,
                resume_id=resume.id,
                status=ApplicationStatus.APPLIED,
            )

        saved = application_crud.save_match_result(
            db,
            db_obj=existing,
            resume_id=resume.id,
            match=match,
            status=ApplicationStatus.SCREENING if not is_new else ApplicationStatus.APPLIED,
        )

        if is_new and saved:
            candidate_label = (
                saved.candidate.user.full_name
                if saved.candidate and saved.candidate.user
                else "A candidate"
            )
            job_label = saved.job.title if saved.job else "a role"
            notification_service.notify_hiring_event(
                db,
                application=saved,
                title="New application",
                message=f"{candidate_label} applied for {job_label}.",
                notification_type=NotificationType.INFO,
                event="application_received",
                notify_candidate=True,
            )
            saved = application_crud.update_status(
                db,
                db_obj=saved,
                status=ApplicationStatus.SCREENING,
            )

        return _to_response(saved)

    def apply(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        data: ApplicationApplyRequest,
    ) -> ApplicationResponse:
        job = job_crud.get(db, data.job_id)
        if job is None:
            raise NotFoundError("Job not found")
        if job.status != JobStatus.OPEN:
            raise AppException(
                "This job is not open for applications",
                status_code=400,
                code="job_not_open",
            )
        if job.closes_at is not None:
            deadline = job.closes_at
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=UTC)
            if datetime.now(UTC) > deadline:
                raise AppException(
                    "The application deadline for this job has passed",
                    status_code=400,
                    code="job_closed",
                )

        existing = application_crud.get_by_job_candidate(
            db, job_id=job.id, candidate_id=candidate_id
        )
        if existing is not None:
            raise ConflictError("You have already applied to this job")

        resume = None
        if data.resume_id:
            resume = resume_crud.get(db, data.resume_id)
            if resume is None or resume.candidate_id != candidate_id:
                raise NotFoundError("Resume not found")
        else:
            resume = resume_crud.get_primary_or_latest(db, candidate_id=candidate_id)
        if resume is None:
            raise AppException(
                "Upload a resume before applying",
                status_code=400,
                code="resume_required",
            )

        # Prefer AI screening when OpenAI + parsed resume are available
        can_match = bool(
            settings.OPENAI_API_KEY
            and (
                resume.status == ResumeStatus.PARSED
                or resume.parsed_data
                or resume.raw_text
            )
        )
        if can_match:
            try:
                return self.compare(
                    db,
                    data=ApplicationCompareRequest(job_id=job.id, resume_id=resume.id),
                )
            except AppException:
                # Fall through to a plain application if matching fails
                pass

        created = application_crud.create(
            db,
            job_id=job.id,
            candidate_id=candidate_id,
            resume_id=resume.id,
            status=ApplicationStatus.APPLIED,
        )
        candidate_label = (
            created.candidate.user.full_name
            if created.candidate and created.candidate.user
            else "A candidate"
        )
        job_label = created.job.title if created.job else "a role"
        notification_service.notify_hiring_event(
            db,
            application=created,
            title="New application",
            message=f"{candidate_label} applied for {job_label}.",
            notification_type=NotificationType.INFO,
            event="application_received",
            notify_candidate=True,
        )
        return _to_response(created)

    def update_status(
        self,
        db: Session,
        application_id: uuid.UUID,
        *,
        data: ApplicationStatusUpdate,
    ) -> ApplicationResponse:
        obj = application_crud.get(db, application_id)
        if obj is None:
            raise NotFoundError("Application not found")

        previous = obj.status
        updated = application_crud.update_status(db, db_obj=obj, status=data.status)

        if previous != data.status and updated:
            candidate_label = (
                updated.candidate.user.full_name
                if updated.candidate and updated.candidate.user
                else "Candidate"
            )
            job_label = updated.job.title if updated.job else "role"
            ntype = NotificationType.INFO
            title = "Application updated"
            message = f"{candidate_label} → {data.status.value} for {job_label}."
            if data.status == ApplicationStatus.REJECTED:
                ntype = NotificationType.WARNING
                title = "Candidate rejected"
            elif data.status in (ApplicationStatus.HIRED, ApplicationStatus.OFFERED):
                ntype = NotificationType.SUCCESS
                title = "Candidate selected"
            notification_service.notify_hiring_event(
                db,
                application=updated,
                title=title,
                message=message,
                notification_type=ntype,
                event=f"status_{data.status.value}",
                notify_candidate=data.status
                in (
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.HIRED,
                    ApplicationStatus.OFFERED,
                    ApplicationStatus.INTERVIEW,
                ),
            )

        return _to_response(updated)

    def get(self, db: Session, application_id: uuid.UUID) -> ApplicationResponse:
        obj = application_crud.get(db, application_id)
        if obj is None:
            raise NotFoundError("Application not found")
        return _to_response(obj)

    def build_report(self, db: Session, application_id: uuid.UUID) -> tuple[str, str]:
        """Return (filename, markdown report body) for a stored screening result."""
        obj = application_crud.get(db, application_id)
        if obj is None:
            raise NotFoundError("Application not found")
        data = _to_response(obj)

        def bullets(items: list[str], empty: str = "_None_") -> str:
            if not items:
                return empty
            return "\n".join(f"- {item}" for item in items)

        generated = data.updated_at.isoformat()
        body = f"""# HirePulse Screening Report

**Generated:** {generated}
**Application ID:** {data.id}

## Candidate
- **Name:** {data.candidate_name or "—"}
- **Email:** {data.candidate_email or "—"}
- **Resume:** {data.resume_file_name or "—"}

## Job
- **Title:** {data.job_title or "—"}
- **Company:** {data.company_name or "—"}
- **Status:** {data.status.value}

## Scores
| Metric | Score |
|---|---|
| Job match score | {data.match_score if data.match_score is not None else "—"} / 100 |
| ATS score | {data.ats_score if data.ats_score is not None else "—"} / 100 |

## Summary
{data.summary or "_No summary_"}

## Matching skills
{bullets(data.matching_skills)}

## Missing skills
{bullets(data.missing_skills)}

## Strengths
{bullets(data.strengths)}

## Weaknesses
{bullets(data.weaknesses)}

## Resume suggestions
{bullets(data.suggestions)}

## Reasoning
{data.reasoning or "_No reasoning_"}
"""
        safe_name = (data.candidate_name or "candidate").replace(" ", "_")
        safe_job = (data.job_title or "role").replace(" ", "_")
        filename = f"screening_{safe_name}_{safe_job}_{str(data.id)[:8]}.md"
        return filename, body

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        job_id: uuid.UUID | None = None,
        candidate_id: uuid.UUID | None = None,
        status: ApplicationStatus | None = None,
        sort_by: ApplicationSortField = "created_at",
        sort_order: SortOrder = "desc",
    ) -> ApplicationListResponse:
        items, total, pages = application_crud.list(
            db,
            page=page,
            page_size=page_size,
            job_id=job_id,
            candidate_id=candidate_id,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return ApplicationListResponse(
            items=[_to_response(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


application_service = ApplicationService()

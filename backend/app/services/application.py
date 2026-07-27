"""Application / resume-job matching business logic."""

from __future__ import annotations

import json
import uuid

from sqlalchemy.orm import Session

from app.ai.job_matcher import compare_resume_to_job
from app.core.exceptions import AppException, NotFoundError
from app.crud.application import application as application_crud
from app.crud.job import job as job_crud
from app.crud.resume import resume as resume_crud
from app.models.application import Application
from app.models.enums import ApplicationStatus, NotificationType, ResumeStatus
from app.schemas.application import (
    ApplicationCompareRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationSortField,
    ApplicationStatusUpdate,
    SortOrder,
)
from app.core.config import settings
from app.services.notification import notification_service
from app.services.voice_call import voice_call_service
from app.services.whatsapp import whatsapp_service
from app.services.whatsapp_templates import WhatsappEvent


def _to_response(obj: Application) -> ApplicationResponse:
    candidate_name = None
    candidate_email = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
        candidate_email = obj.candidate.user.email

    job_title = obj.job.title if obj.job else None
    company_name = obj.job.company.name if obj.job and obj.job.company else None
    resume_file_name = obj.resume.file_name if obj.resume else None

    matching = obj.matching_skills or []
    missing = obj.missing_skills or []
    if not isinstance(matching, list):
        matching = []
    if not isinstance(missing, list):
        missing = []

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
        matching_skills=[str(s) for s in matching],
        missing_skills=[str(s) for s in missing],
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
        if resume.status != ResumeStatus.PARSED and not resume.parsed_data and not resume.raw_text:
            raise AppException(
                "Resume must be parsed before matching",
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

        # Auto WhatsApp: Application Received (new applications)
        if is_new and saved:
            whatsapp_service.notify_application_event(
                db,
                application=saved,
                event=WhatsappEvent.APPLICATION_RECEIVED,
                allow_missing_twilio=True,
            )
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
                event=WhatsappEvent.APPLICATION_RECEIVED.value,
                notify_candidate=True,
                include_whatsapp_history=True,
            )
            # After received notice, move into screening
            saved = application_crud.update_status(
                db,
                db_obj=saved,
                status=ApplicationStatus.SCREENING,
            )
            # Auto Vapi AI screening call
            if settings.VAPI_AUTO_CALL_ON_APPLY:
                voice_call_service.initiate_for_application(
                    db,
                    application=saved,
                    allow_missing_vapi=True,
                )

        return _to_response(saved)

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

        if data.send_whatsapp and previous != data.status:
            event = None
            if data.status == ApplicationStatus.APPLIED:
                event = WhatsappEvent.APPLICATION_RECEIVED
            elif data.status == ApplicationStatus.REJECTED:
                event = WhatsappEvent.REJECTED
            elif data.status in (ApplicationStatus.HIRED, ApplicationStatus.OFFERED):
                event = WhatsappEvent.SELECTED
            if event:
                whatsapp_service.notify_application_event(
                    db,
                    application=updated,
                    event=event,
                    allow_missing_twilio=True,
                )

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
                include_whatsapp_history=False,
            )

        return _to_response(updated)

    def get(self, db: Session, application_id: uuid.UUID) -> ApplicationResponse:
        obj = application_crud.get(db, application_id)
        if obj is None:
            raise NotFoundError("Application not found")
        return _to_response(obj)

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

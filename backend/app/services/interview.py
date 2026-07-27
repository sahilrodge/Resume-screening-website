"""Interview business logic with WhatsApp invite auto-send."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.crud.application import application as application_crud
from app.crud.interview import interview as interview_crud
from app.models.enums import ApplicationStatus, NotificationType
from app.models.interview import Interview
from app.schemas.interview import InterviewCreate, InterviewListResponse, InterviewResponse
from app.services.notification import notification_service
from app.services.whatsapp import whatsapp_service
from app.services.whatsapp_templates import WhatsappEvent


def _to_response(obj: Interview) -> InterviewResponse:
    app = obj.application
    candidate_id = app.candidate_id if app else None
    candidate_name = None
    job_title = None
    company_name = None
    if app and app.candidate and app.candidate.user:
        candidate_name = app.candidate.user.full_name
    if app and app.job:
        job_title = app.job.title
        if app.job.company:
            company_name = app.job.company.name

    return InterviewResponse(
        id=obj.id,
        application_id=obj.application_id,
        candidate_id=candidate_id,
        candidate_name=candidate_name,
        job_title=job_title,
        company_name=company_name,
        interviewer_id=obj.interviewer_id,
        interview_type=obj.interview_type,
        status=obj.status,
        scheduled_at=obj.scheduled_at,
        duration_minutes=obj.duration_minutes,
        meeting_link=obj.meeting_link,
        location=obj.location,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


class InterviewService:
    def create(self, db: Session, *, data: InterviewCreate) -> InterviewResponse:
        application = application_crud.get(db, data.application_id)
        if application is None:
            raise NotFoundError("Application not found")

        created = interview_crud.create(
            db,
            application_id=data.application_id,
            scheduled_at=data.scheduled_at,
            interview_type=data.interview_type,
            duration_minutes=data.duration_minutes,
            meeting_link=data.meeting_link,
            location=data.location,
        )

        # Move application into interview status
        application_crud.update_status(
            db,
            db_obj=application,
            status=ApplicationStatus.INTERVIEW,
        )
        # Refresh with relationships
        created = interview_crud.get(db, created.id)

        if data.send_whatsapp and created and created.application:
            whatsapp_service.notify_application_event(
                db,
                application=created.application,
                event=WhatsappEvent.INTERVIEW_INVITE,
                interview=created,
                allow_missing_twilio=True,
            )

        if created and created.application:
            candidate_label = (
                created.application.candidate.user.full_name
                if created.application.candidate and created.application.candidate.user
                else "Candidate"
            )
            job_label = created.application.job.title if created.application.job else "role"
            when = created.scheduled_at.strftime("%d %b %Y, %I:%M %p")
            notification_service.notify_hiring_event(
                db,
                application=created.application,
                title="Interview scheduled",
                message=f"{candidate_label} · {job_label} · {when}",
                notification_type=NotificationType.SUCCESS,
                event=WhatsappEvent.INTERVIEW_INVITE.value,
                interview=created,
                link=f"/screening/{created.application_id}",
                notify_candidate=True,
                include_whatsapp_history=True,
            )

        assert created is not None
        return _to_response(created)

    def list(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        application_id: uuid.UUID | None = None,
    ) -> InterviewListResponse:
        items, total = interview_crud.list(
            db,
            skip=(page - 1) * page_size,
            limit=page_size,
            application_id=application_id,
        )
        return InterviewListResponse(items=[_to_response(i) for i in items], total=total)

    def get(self, db: Session, interview_id: uuid.UUID) -> InterviewResponse:
        obj = interview_crud.get(db, interview_id)
        if obj is None:
            raise NotFoundError("Interview not found")
        return _to_response(obj)


interview_service = InterviewService()

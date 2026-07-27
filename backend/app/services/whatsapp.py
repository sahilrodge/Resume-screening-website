"""WhatsApp messaging business logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.crud.candidate import candidate as candidate_crud
from app.crud.whatsapp_log import whatsapp_log as whatsapp_log_crud
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.enums import InterviewStatus, WhatsappDirection, WhatsappStatus
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.models.whatsapp_log import WhatsappLog
from app.schemas.whatsapp import (
    ReminderSendResponse,
    WhatsappLogListResponse,
    WhatsappLogResponse,
)
from app.services.whatsapp_templates import WhatsappEvent, build_message
from app.utils.twilio_whatsapp import (
    normalize_whatsapp_number,
    send_whatsapp_message,
    strip_whatsapp_prefix,
    validate_twilio_request,
)

logger = get_logger(__name__)

_STATUS_MAP = {
    "queued": WhatsappStatus.QUEUED,
    "accepted": WhatsappStatus.QUEUED,
    "sending": WhatsappStatus.QUEUED,
    "sent": WhatsappStatus.SENT,
    "delivered": WhatsappStatus.DELIVERED,
    "read": WhatsappStatus.READ,
    "failed": WhatsappStatus.FAILED,
    "undelivered": WhatsappStatus.FAILED,
}


def _to_response(obj: WhatsappLog) -> WhatsappLogResponse:
    candidate_name = None
    if obj.candidate and obj.candidate.user:
        candidate_name = obj.candidate.user.full_name
    meta = obj.meta or {}
    return WhatsappLogResponse(
        id=obj.id,
        user_id=obj.user_id,
        candidate_id=obj.candidate_id,
        candidate_name=candidate_name,
        to_number=obj.to_number,
        from_number=obj.from_number,
        direction=obj.direction,
        status=obj.status,
        message_body=obj.message_body,
        provider_message_id=obj.provider_message_id,
        error_message=obj.error_message,
        event_type=meta.get("event_type"),
        meta=meta,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


class WhatsappService:
    def list_logs(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 20,
        candidate_id: uuid.UUID | None = None,
        direction: WhatsappDirection | None = None,
        event_type: str | None = None,
    ) -> WhatsappLogListResponse:
        items, total, pages = whatsapp_log_crud.list(
            db,
            page=page,
            page_size=page_size,
            candidate_id=candidate_id,
            direction=direction,
            event_type=event_type,
        )
        return WhatsappLogListResponse(
            items=[_to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    def get(self, db: Session, log_id: uuid.UUID) -> WhatsappLogResponse:
        obj = whatsapp_log_crud.get(db, log_id)
        if obj is None:
            raise NotFoundError("WhatsApp message not found")
        return _to_response(obj)

    def send_to_candidate(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        event: WhatsappEvent,
        body: str | None = None,
        application_id: uuid.UUID | None = None,
        interview_id: uuid.UUID | None = None,
        job_title: str | None = None,
        company_name: str | None = None,
        interview_at: str | None = None,
        meeting_link: str | None = None,
        location: str | None = None,
        allow_missing_twilio: bool = False,
    ) -> WhatsappLogResponse:
        candidate = candidate_crud.get(db, candidate_id)
        if candidate is None:
            raise NotFoundError("Candidate not found")
        if not candidate.phone:
            raise AppException(
                "Candidate has no phone number for WhatsApp",
                status_code=400,
                code="candidate_phone_missing",
            )

        name = candidate.user.full_name if candidate.user else "there"
        message = body or build_message(
            event,
            candidate_name=name,
            job_title=job_title or "the role",
            company_name=company_name,
            interview_at=interview_at,
            meeting_link=meeting_link,
            location=location,
        )

        to_number = normalize_whatsapp_number(candidate.phone)
        from_number = settings.TWILIO_WHATSAPP_FROM or "whatsapp:+00000000000"
        meta: dict[str, Any] = {
            "event_type": event.value,
            "application_id": str(application_id) if application_id else None,
            "interview_id": str(interview_id) if interview_id else None,
        }

        if not settings.twilio_configured:
            if not allow_missing_twilio:
                raise AppException(
                    "Twilio WhatsApp is not configured",
                    status_code=503,
                    code="twilio_not_configured",
                )
            log = whatsapp_log_crud.create(
                db,
                to_number=strip_whatsapp_prefix(to_number),
                from_number=strip_whatsapp_prefix(from_number),
                direction=WhatsappDirection.OUTBOUND,
                status=WhatsappStatus.FAILED,
                message_body=message,
                error_message="Twilio not configured",
                candidate_id=candidate.id,
                user_id=candidate.user_id,
                meta=meta,
            )
            return _to_response(log)

        result = send_whatsapp_message(to=to_number, body=message)
        status = _STATUS_MAP.get((result.status or "").lower(), WhatsappStatus.QUEUED)
        if result.error:
            status = WhatsappStatus.FAILED

        log = whatsapp_log_crud.create(
            db,
            to_number=strip_whatsapp_prefix(to_number),
            from_number=strip_whatsapp_prefix(from_number),
            direction=WhatsappDirection.OUTBOUND,
            status=status,
            message_body=message,
            provider_message_id=result.sid,
            error_message=result.error,
            candidate_id=candidate.id,
            user_id=candidate.user_id,
            meta=meta,
        )
        return _to_response(log)

    def notify_application_event(
        self,
        db: Session,
        *,
        application: Application,
        event: WhatsappEvent,
        interview: Interview | None = None,
        allow_missing_twilio: bool = True,
    ) -> WhatsappLogResponse | None:
        """Best-effort auto-send; never blocks core hiring flows when Twilio is down."""
        try:
            job_title = application.job.title if application.job else "the role"
            company_name = (
                application.job.company.name if application.job and application.job.company else None
            )
            interview_at = None
            meeting_link = None
            location = None
            interview_id = None
            if interview is not None:
                interview_id = interview.id
                interview_at = interview.scheduled_at.strftime("%d %b %Y, %I:%M %p %Z").strip()
                meeting_link = interview.meeting_link
                location = interview.location

            return self.send_to_candidate(
                db,
                candidate_id=application.candidate_id,
                event=event,
                application_id=application.id,
                interview_id=interview_id,
                job_title=job_title,
                company_name=company_name,
                interview_at=interview_at,
                meeting_link=meeting_link,
                location=location,
                allow_missing_twilio=allow_missing_twilio,
            )
        except AppException as exc:
            logger.warning("WhatsApp auto-send skipped: %s", exc.message)
            return None
        except Exception:  # noqa: BLE001
            logger.exception("WhatsApp auto-send failed")
            return None

    def handle_inbound_webhook(
        self,
        db: Session,
        *,
        form: dict[str, str],
        request_url: str,
        signature: str | None,
    ) -> WhatsappLogResponse:
        if not validate_twilio_request(url=request_url, params=form, signature=signature):
            raise AppException("Invalid Twilio signature", status_code=403, code="invalid_signature")

        from_number = form.get("From", "")
        to_number = form.get("To", "")
        body = form.get("Body")
        sid = form.get("MessageSid") or form.get("SmsMessageSid")

        candidate = whatsapp_log_crud.find_candidate_by_phone(db, from_number)
        meta = {
            "event_type": WhatsappEvent.INBOUND_REPLY.value,
            "profile_name": form.get("ProfileName"),
            "wa_id": form.get("WaId"),
        }

        log = whatsapp_log_crud.create(
            db,
            to_number=strip_whatsapp_prefix(to_number),
            from_number=strip_whatsapp_prefix(from_number),
            direction=WhatsappDirection.INBOUND,
            status=WhatsappStatus.DELIVERED,
            message_body=body,
            provider_message_id=sid,
            candidate_id=candidate.id if candidate else None,
            user_id=candidate.user_id if candidate else None,
            meta=meta,
        )
        return _to_response(log)

    def handle_status_webhook(
        self,
        db: Session,
        *,
        form: dict[str, str],
        request_url: str,
        signature: str | None,
    ) -> WhatsappLogResponse | None:
        if not validate_twilio_request(url=request_url, params=form, signature=signature):
            raise AppException("Invalid Twilio signature", status_code=403, code="invalid_signature")

        sid = form.get("MessageSid") or form.get("SmsSid")
        if not sid:
            return None
        log = whatsapp_log_crud.get_by_provider_id(db, sid)
        if log is None:
            return None

        status_raw = (form.get("MessageStatus") or form.get("SmsStatus") or "").lower()
        status = _STATUS_MAP.get(status_raw, log.status)
        error = form.get("ErrorMessage") or form.get("ErrorCode")
        updated = whatsapp_log_crud.update_status(
            db,
            db_obj=log,
            status=status,
            error_message=str(error) if error else None,
        )
        return _to_response(updated)

    def send_due_reminders(self, db: Session) -> ReminderSendResponse:
        hours = settings.WHATSAPP_REMINDER_HOURS
        now = datetime.now(timezone.utc)
        until = now + timedelta(hours=hours)

        stmt = (
            select(Interview)
            .options(
                joinedload(Interview.application)
                .joinedload(Application.job)
                .joinedload(Job.company),
                joinedload(Interview.application)
                .joinedload(Application.candidate)
                .joinedload(Candidate.user),
            )
            .where(
                Interview.status == InterviewStatus.SCHEDULED,
                Interview.scheduled_at >= now,
                Interview.scheduled_at <= until,
            )
        )
        interviews = list(db.scalars(stmt).unique().all())

        sent = 0
        skipped = 0
        failures = 0
        items: list[WhatsappLogResponse] = []

        for interview in interviews:
            if whatsapp_log_crud.reminder_already_sent(db, interview.id):
                skipped += 1
                continue
            app = interview.application
            if app is None:
                skipped += 1
                continue
            result = self.notify_application_event(
                db,
                application=app,
                event=WhatsappEvent.REMINDER,
                interview=interview,
                allow_missing_twilio=True,
            )
            if result is None or result.status == WhatsappStatus.FAILED:
                failures += 1
            else:
                sent += 1
            if result:
                items.append(result)

        return ReminderSendResponse(sent=sent, skipped=skipped, failures=failures, items=items)


whatsapp_service = WhatsappService()

"""Interview business logic."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.crud.application import application as application_crud
from app.crud.interview import interview as interview_crud
from app.models.enums import ApplicationStatus, InterviewStatus, NotificationType
from app.models.interview import Interview
from app.schemas.interview import (
    InterviewCreate,
    InterviewListResponse,
    InterviewResponse,
    InterviewStatusUpdate,
    InterviewTimelineStep,
)
from app.services.notification import notification_service

# Progression ranks used to build the interview timeline
_STATUS_RANK: dict[InterviewStatus, int] = {
    InterviewStatus.SCHEDULED: 0,
    InterviewStatus.RESCHEDULED: 0,
    InterviewStatus.CONFIRMED: 1,
    InterviewStatus.IN_PROGRESS: 2,
    InterviewStatus.COMPLETED: 3,
    InterviewStatus.SELECTED: 4,
    InterviewStatus.REJECTED: 4,
    InterviewStatus.CANCELLED: -1,
    InterviewStatus.NO_SHOW: -1,
}


def _parse_history_at(raw: object) -> datetime | None:
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _history_timestamp(history: list, *statuses: str) -> datetime | None:
    for entry in reversed(history or []):
        if not isinstance(entry, dict):
            continue
        if str(entry.get("status") or "") in statuses:
            return _parse_history_at(entry.get("at"))
    return None


def _build_timeline(obj: Interview) -> list[InterviewTimelineStep]:
    history = list(obj.status_history or [])
    rank = _STATUS_RANK.get(obj.status, 0)
    terminal_alt = obj.status in {InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW}

    scheduled_at = (
        _history_timestamp(history, "scheduled")
        or obj.created_at
        or obj.scheduled_at
    )
    confirmed_at = _history_timestamp(history, "confirmed")
    started_at = _history_timestamp(history, "in_progress")
    completed_at = _history_timestamp(history, "completed")
    decision_at = _history_timestamp(history, "selected", "rejected")

    steps_meta = [
        ("scheduled", "Interview Scheduled", 0, scheduled_at),
        ("confirmed", "Interview Confirmed", 1, confirmed_at),
        ("started", "Interview Started", 2, started_at),
        ("completed", "Interview Completed", 3, completed_at),
        ("decision", "Final Decision", 4, decision_at),
    ]

    steps: list[InterviewTimelineStep] = []
    for key, label, needed, at in steps_meta:
        if terminal_alt and key != "scheduled":
            completed = False
            current = False
        else:
            completed = rank >= needed and not terminal_alt
            # Current = highest completed milestone matching status band
            if key == "decision":
                current = obj.status in {
                    InterviewStatus.SELECTED,
                    InterviewStatus.REJECTED,
                }
            elif key == "completed":
                current = obj.status == InterviewStatus.COMPLETED
            elif key == "started":
                current = obj.status == InterviewStatus.IN_PROGRESS
            elif key == "confirmed":
                current = obj.status == InterviewStatus.CONFIRMED
            else:
                current = obj.status in {
                    InterviewStatus.SCHEDULED,
                    InterviewStatus.RESCHEDULED,
                }
            if terminal_alt:
                current = False
        steps.append(
            InterviewTimelineStep(
                key=key,
                label=label,
                completed=completed,
                current=current,
                at=at if completed or current else None,
            )
        )
    return steps


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

    history = obj.status_history if isinstance(obj.status_history, list) else []

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
        status_changed_at=obj.status_changed_at,
        status_history=history,
        timeline=_build_timeline(obj),
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

        application_crud.update_status(
            db,
            db_obj=application,
            status=ApplicationStatus.INTERVIEW,
        )
        created = interview_crud.get(db, created.id)

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
                event="interview_invite",
                interview=created,
                link=f"/screening/{created.application_id}",
                notify_candidate=True,
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
        candidate_id: uuid.UUID | None = None,
    ) -> InterviewListResponse:
        items, total = interview_crud.list(
            db,
            skip=(page - 1) * page_size,
            limit=page_size,
            application_id=application_id,
            candidate_id=candidate_id,
        )
        return InterviewListResponse(items=[_to_response(i) for i in items], total=total)

    def list_for_candidate(
        self,
        db: Session,
        *,
        candidate_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
    ) -> InterviewListResponse:
        return self.list(
            db,
            page=page,
            page_size=page_size,
            candidate_id=candidate_id,
        )

    def get(self, db: Session, interview_id: uuid.UUID) -> InterviewResponse:
        obj = interview_crud.get(db, interview_id)
        if obj is None:
            raise NotFoundError("Interview not found")
        return _to_response(obj)

    def update_status(
        self,
        db: Session,
        interview_id: uuid.UUID,
        *,
        data: InterviewStatusUpdate,
    ) -> InterviewResponse:
        obj = interview_crud.get(db, interview_id)
        if obj is None:
            raise NotFoundError("Interview not found")

        previous = obj.status
        updated = interview_crud.update_status(db, db_obj=obj, status=data.status)

        # Sync application decision statuses where appropriate
        if updated and updated.application and previous != data.status:
            application = updated.application
            if data.status == InterviewStatus.SELECTED:
                application_crud.update_status(
                    db,
                    db_obj=application,
                    status=ApplicationStatus.SELECTED,
                )
            elif data.status == InterviewStatus.REJECTED:
                application_crud.update_status(
                    db,
                    db_obj=application,
                    status=ApplicationStatus.REJECTED,
                )
            elif data.status == InterviewStatus.CONFIRMED:
                if application.status in {
                    ApplicationStatus.APPLIED,
                    ApplicationStatus.SCREENING,
                    ApplicationStatus.SHORTLISTED,
                }:
                    application_crud.update_status(
                        db,
                        db_obj=application,
                        status=ApplicationStatus.INTERVIEW,
                    )

            updated = interview_crud.get(db, interview_id)
            assert updated is not None

            candidate_label = (
                updated.application.candidate.user.full_name
                if updated.application
                and updated.application.candidate
                and updated.application.candidate.user
                else "Candidate"
            )
            job_label = (
                updated.application.job.title
                if updated.application and updated.application.job
                else "role"
            )
            notification_service.notify_hiring_event(
                db,
                application=updated.application,
                title="Interview status updated",
                message=(
                    f"{candidate_label} · {job_label} · "
                    f"{data.status.value.replace('_', ' ').title()}"
                ),
                notification_type=(
                    NotificationType.SUCCESS
                    if data.status
                    in {InterviewStatus.SELECTED, InterviewStatus.COMPLETED, InterviewStatus.CONFIRMED}
                    else NotificationType.WARNING
                    if data.status
                    in {InterviewStatus.REJECTED, InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW}
                    else NotificationType.INFO
                ),
                event=f"interview_status_{data.status.value}",
                interview=updated,
                link=f"/screening/{updated.application_id}",
                notify_candidate=True,
            )

        assert updated is not None
        return _to_response(updated)


interview_service = InterviewService()
